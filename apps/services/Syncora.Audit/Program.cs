using System.Text.Json;
using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
var connection = builder.Configuration.GetConnectionString("AuditDatabase")
    ?? Environment.GetEnvironmentVariable("AUDIT_DATABASE_URL")
    ?? "Data Source=syncora-audit.db";
var sqlite = connection.StartsWith("Data Source=", StringComparison.OrdinalIgnoreCase);
builder.Services.AddDbContext<AuditDb>(options => {
    if (sqlite) options.UseSqlite(connection); else options.UseNpgsql(connection);
});
builder.Services.AddHealthChecks();
builder.Services.AddEndpointsApiExplorer();
var app = builder.Build();
if (app.Environment.IsDevelopment()) {
    using var scope = app.Services.CreateScope();
    var database = scope.ServiceProvider.GetRequiredService<AuditDb>().Database;
    if (sqlite) await database.EnsureCreatedAsync(); else await database.MigrateAsync();
}
app.Use(async (context, next) => {
    context.Response.Headers.XContentTypeOptions = "nosniff";
    context.Response.Headers.XFrameOptions = "DENY";
    await next();
});
app.MapHealthChecks("/health");

app.MapPost("/internal/audit", async (AuditInput input, HttpRequest request, IConfiguration config, AuditDb db) => {
    if (!AuditPolicy.Authorized(request.Headers["X-Service-Key"], config["AUDIT_SERVICE_KEY"] ?? "development-audit-key")) return Results.Unauthorized();
    if (!AuditPolicy.Valid(input)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["action"] = ["Audit fields are required"] });
    var record = new AuditRecord {
        OrganizationId = input.OrganizationId, ActorId = input.ActorId, Action = input.Action,
        Entity = input.Entity, EntityId = input.EntityId,
        MetadataJson = JsonSerializer.Serialize(input.Metadata), OccurredAt = DateTimeOffset.UtcNow
    };
    db.AuditRecords.Add(record);
    await db.SaveChangesAsync();
    return Results.Created($"/internal/audit/{record.Id}", new { record.Id, record.OccurredAt });
});

app.MapGet("/internal/audit", async (Guid organizationId, HttpRequest request, IConfiguration config, AuditDb db) => {
    if (!AuditPolicy.Authorized(request.Headers["X-Service-Key"], config["AUDIT_SERVICE_KEY"] ?? "development-audit-key")) return Results.Unauthorized();
    var records = await db.AuditRecords.AsNoTracking().Where(x => x.OrganizationId == organizationId)
        .OrderByDescending(x => x.OccurredAt).Take(200).ToListAsync();
    return Results.Ok(records);
});

app.Run();

public record AuditInput(Guid OrganizationId, Guid ActorId, string Action, string Entity, Guid EntityId, Dictionary<string, object>? Metadata);
public static class AuditPolicy {
    public static bool Authorized(string? supplied, string expected) => !string.IsNullOrWhiteSpace(expected) && CryptographicOperations.FixedTimeEquals(System.Text.Encoding.UTF8.GetBytes(supplied ?? ""), System.Text.Encoding.UTF8.GetBytes(expected));
    public static bool Valid(AuditInput input) => input.OrganizationId != Guid.Empty && input.ActorId != Guid.Empty && input.EntityId != Guid.Empty && !string.IsNullOrWhiteSpace(input.Action) && !string.IsNullOrWhiteSpace(input.Entity);
}
public sealed class AuditRecord {
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid OrganizationId { get; init; }
    public Guid ActorId { get; init; }
    public required string Action { get; init; }
    public required string Entity { get; init; }
    public Guid EntityId { get; init; }
    public string MetadataJson { get; init; } = "{}";
    public DateTimeOffset OccurredAt { get; init; }
}
public sealed class AuditDb(DbContextOptions<AuditDb> options) : DbContext(options) {
    public DbSet<AuditRecord> AuditRecords => Set<AuditRecord>();
    protected override void OnModelCreating(ModelBuilder modelBuilder) {
        var entity = modelBuilder.Entity<AuditRecord>();
        entity.ToTable("audit_log");
        entity.HasKey(x => x.Id);
        entity.HasIndex(x => new { x.OrganizationId, x.OccurredAt });
        entity.Property(x => x.Action).HasMaxLength(120);
        entity.Property(x => x.Entity).HasMaxLength(80);
        entity.Property(x => x.MetadataJson).HasColumnType(Database.IsSqlite() ? "TEXT" : "jsonb");
    }
}
public partial class Program { }

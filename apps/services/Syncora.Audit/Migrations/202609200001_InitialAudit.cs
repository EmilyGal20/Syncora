using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable
namespace Syncora.Audit.Migrations;

public partial class InitialAudit : Migration {
    protected override void Up(MigrationBuilder migrationBuilder) {
        migrationBuilder.CreateTable(
            name: "audit_log",
            columns: table => new {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                OrganizationId = table.Column<Guid>(type: "uuid", nullable: false),
                ActorId = table.Column<Guid>(type: "uuid", nullable: false),
                Action = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                Entity = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                EntityId = table.Column<Guid>(type: "uuid", nullable: false),
                MetadataJson = table.Column<string>(type: "jsonb", nullable: false),
                OccurredAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            }, constraints: table => table.PrimaryKey("PK_audit_log", x => x.Id));
        migrationBuilder.CreateIndex(name: "IX_audit_log_OrganizationId_OccurredAt", table: "audit_log", columns: new[] { "OrganizationId", "OccurredAt" });
    }
    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.DropTable(name: "audit_log");
}


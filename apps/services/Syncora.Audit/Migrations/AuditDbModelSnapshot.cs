using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;

#nullable disable
namespace Syncora.Audit.Migrations;
[DbContext(typeof(AuditDb))]
partial class AuditDbModelSnapshot : ModelSnapshot {
    protected override void BuildModel(ModelBuilder modelBuilder) {
        modelBuilder.HasAnnotation("ProductVersion", "8.0.20").HasAnnotation("Relational:MaxIdentifierLength", 63);
        modelBuilder.Entity("AuditRecord", b => {
            b.Property<Guid>("Id").ValueGeneratedOnAdd().HasColumnType("uuid");
            b.Property<string>("Action").IsRequired().HasMaxLength(120).HasColumnType("character varying(120)");
            b.Property<Guid>("ActorId").HasColumnType("uuid");
            b.Property<string>("Entity").IsRequired().HasMaxLength(80).HasColumnType("character varying(80)");
            b.Property<Guid>("EntityId").HasColumnType("uuid");
            b.Property<string>("MetadataJson").IsRequired().HasColumnType("jsonb");
            b.Property<DateTimeOffset>("OccurredAt").HasColumnType("timestamp with time zone");
            b.Property<Guid>("OrganizationId").HasColumnType("uuid");
            b.HasKey("Id");
            b.HasIndex("OrganizationId", "OccurredAt");
            b.ToTable("audit_log");
        });
    }
}


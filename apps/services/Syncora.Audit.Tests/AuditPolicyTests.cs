using Xunit;

public sealed class AuditPolicyTests {
    [Fact]
    public void ServiceKeyMustMatch() {
        Assert.True(AuditPolicy.Authorized("shared-secret", "shared-secret"));
        Assert.False(AuditPolicy.Authorized("wrong-secret", "shared-secret"));
    }
    [Fact]
    public void AuditInputRequiresTenantActorTargetAndNames() {
        var valid = new AuditInput(Guid.NewGuid(), Guid.NewGuid(), "user.changed", "user", Guid.NewGuid(), null);
        Assert.True(AuditPolicy.Valid(valid));
        Assert.False(AuditPolicy.Valid(valid with { OrganizationId = Guid.Empty }));
        Assert.False(AuditPolicy.Valid(valid with { Action = "" }));
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clarive.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddMcpServerSyncIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "ix_mcp_servers_active_next_sync",
                table: "mcp_servers",
                columns: new[] { "is_active", "next_synced_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_mcp_servers_active_next_sync",
                table: "mcp_servers");
        }
    }
}

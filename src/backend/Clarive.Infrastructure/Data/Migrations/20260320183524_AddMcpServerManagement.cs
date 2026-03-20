using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clarive.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddMcpServerManagement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "mcp_server_id",
                table: "tool_descriptions",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "mcp_servers",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    url = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    bearer_token_encrypted = table.Column<string>(type: "text", nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    last_synced_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    next_synced_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    last_sync_error = table.Column<string>(type: "text", nullable: true),
                    tool_count = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_mcp_servers", x => x.id);
                    table.ForeignKey(
                        name: "FK_mcp_servers_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_tool_descriptions_mcp_server_id",
                table: "tool_descriptions",
                column: "mcp_server_id");

            migrationBuilder.CreateIndex(
                name: "ix_mcp_servers_tenant_id",
                table: "mcp_servers",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "uq_mcp_servers_tenant_url",
                table: "mcp_servers",
                columns: new[] { "tenant_id", "url" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_tool_descriptions_mcp_servers_mcp_server_id",
                table: "tool_descriptions",
                column: "mcp_server_id",
                principalTable: "mcp_servers",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_tool_descriptions_mcp_servers_mcp_server_id",
                table: "tool_descriptions");

            migrationBuilder.DropTable(
                name: "mcp_servers");

            migrationBuilder.DropIndex(
                name: "ix_tool_descriptions_mcp_server_id",
                table: "tool_descriptions");

            migrationBuilder.DropColumn(
                name: "mcp_server_id",
                table: "tool_descriptions");
        }
    }
}

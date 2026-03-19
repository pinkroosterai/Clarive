using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clarive.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAiUsageLog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ai_usage_logs",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    action_type = table.Column<string>(
                        type: "character varying(50)",
                        maxLength: 50,
                        nullable: false
                    ),
                    model = table.Column<string>(
                        type: "character varying(100)",
                        maxLength: 100,
                        nullable: false
                    ),
                    provider = table.Column<string>(
                        type: "character varying(100)",
                        maxLength: 100,
                        nullable: false
                    ),
                    input_tokens = table.Column<long>(type: "bigint", nullable: false),
                    output_tokens = table.Column<long>(type: "bigint", nullable: false),
                    estimated_cost_usd = table.Column<decimal>(
                        type: "numeric(18,8)",
                        precision: 18,
                        scale: 8,
                        nullable: true
                    ),
                    duration_ms = table.Column<long>(type: "bigint", nullable: false),
                    entry_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTime>(
                        type: "timestamp with time zone",
                        nullable: false
                    ),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ai_usage_logs", x => x.id);
                    table.ForeignKey(
                        name: "FK_ai_usage_logs_prompt_entries_entry_id",
                        column: x => x.entry_id,
                        principalTable: "prompt_entries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull
                    );
                    table.ForeignKey(
                        name: "FK_ai_usage_logs_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade
                    );
                }
            );

            migrationBuilder.CreateIndex(
                name: "ix_ai_usage_logs_action_type",
                table: "ai_usage_logs",
                column: "action_type"
            );

            migrationBuilder.CreateIndex(
                name: "IX_ai_usage_logs_entry_id",
                table: "ai_usage_logs",
                column: "entry_id"
            );

            migrationBuilder.CreateIndex(
                name: "ix_ai_usage_logs_model",
                table: "ai_usage_logs",
                column: "model"
            );

            migrationBuilder.CreateIndex(
                name: "ix_ai_usage_logs_tenant_created",
                table: "ai_usage_logs",
                columns: new[] { "tenant_id", "created_at" }
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "ai_usage_logs");
        }
    }
}

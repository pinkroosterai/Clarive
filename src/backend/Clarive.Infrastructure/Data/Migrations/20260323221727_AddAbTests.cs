using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clarive.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAbTests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ab_test_runs",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    entry_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    version_a_number = table.Column<int>(type: "integer", nullable: false),
                    version_b_number = table.Column<int>(type: "integer", nullable: false),
                    dataset_id = table.Column<Guid>(type: "uuid", nullable: true),
                    model = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    temperature = table.Column<float>(type: "real", nullable: false),
                    max_tokens = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    completed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ab_test_runs", x => x.id);
                    table.ForeignKey(
                        name: "FK_ab_test_runs_prompt_entries_entry_id",
                        column: x => x.entry_id,
                        principalTable: "prompt_entries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ab_test_runs_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ab_test_runs_test_datasets_dataset_id",
                        column: x => x.dataset_id,
                        principalTable: "test_datasets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_ab_test_runs_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "ab_test_results",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    run_id = table.Column<Guid>(type: "uuid", nullable: false),
                    dataset_row_id = table.Column<Guid>(type: "uuid", nullable: false),
                    version_a_output = table.Column<string>(type: "text", nullable: true),
                    version_b_output = table.Column<string>(type: "text", nullable: true),
                    version_a_scores = table.Column<string>(type: "jsonb", nullable: true),
                    version_b_scores = table.Column<string>(type: "jsonb", nullable: true),
                    version_a_avg_score = table.Column<double>(type: "double precision", nullable: true),
                    version_b_avg_score = table.Column<double>(type: "double precision", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ab_test_results", x => x.id);
                    table.ForeignKey(
                        name: "FK_ab_test_results_ab_test_runs_run_id",
                        column: x => x.run_id,
                        principalTable: "ab_test_runs",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_ab_test_results_run",
                table: "ab_test_results",
                column: "run_id");

            migrationBuilder.CreateIndex(
                name: "IX_ab_test_runs_dataset_id",
                table: "ab_test_runs",
                column: "dataset_id");

            migrationBuilder.CreateIndex(
                name: "ix_ab_test_runs_entry",
                table: "ab_test_runs",
                column: "entry_id");

            migrationBuilder.CreateIndex(
                name: "ix_ab_test_runs_tenant_entry",
                table: "ab_test_runs",
                columns: new[] { "tenant_id", "entry_id" });

            migrationBuilder.CreateIndex(
                name: "IX_ab_test_runs_user_id",
                table: "ab_test_runs",
                column: "user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ab_test_results");

            migrationBuilder.DropTable(
                name: "ab_test_runs");
        }
    }
}

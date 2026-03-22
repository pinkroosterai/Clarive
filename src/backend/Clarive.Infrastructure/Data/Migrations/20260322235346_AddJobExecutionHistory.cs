using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clarive.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddJobExecutionHistory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "job_execution_history",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    job_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    job_group = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    trigger_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    fire_time_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    started_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    finished_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    duration_ms = table.Column<long>(type: "bigint", nullable: true),
                    succeeded = table.Column<bool>(type: "boolean", nullable: false),
                    exception_message = table.Column<string>(type: "text", nullable: true),
                    exception_stack_trace = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_job_execution_history", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_job_execution_history_fire_time",
                table: "job_execution_history",
                column: "fire_time_utc");

            migrationBuilder.CreateIndex(
                name: "ix_job_execution_history_job_name_fire_time",
                table: "job_execution_history",
                columns: new[] { "job_name", "fire_time_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_job_execution_history_succeeded",
                table: "job_execution_history",
                column: "succeeded");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "job_execution_history");
        }
    }
}

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
            migrationBuilder.Sql(
                """
                CREATE TABLE job_execution_history
                (
                    id UUID NOT NULL PRIMARY KEY,
                    job_name VARCHAR(255) NOT NULL,
                    job_group VARCHAR(255) NOT NULL,
                    trigger_name VARCHAR(255) NOT NULL,
                    fire_time_utc TIMESTAMP NOT NULL,
                    started_at_utc TIMESTAMP NOT NULL,
                    finished_at_utc TIMESTAMP NULL,
                    duration_ms BIGINT NULL,
                    succeeded BOOLEAN NOT NULL,
                    exception_message TEXT NULL,
                    exception_stack_trace TEXT NULL
                );
                """);

            migrationBuilder.Sql(
                "CREATE INDEX ix_job_execution_history_job_name_fire_time ON job_execution_history (job_name, fire_time_utc);");
            migrationBuilder.Sql(
                "CREATE INDEX ix_job_execution_history_succeeded ON job_execution_history (succeeded);");
            migrationBuilder.Sql(
                "CREATE INDEX ix_job_execution_history_fire_time ON job_execution_history (fire_time_utc);");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP TABLE IF EXISTS job_execution_history;");
        }
    }
}

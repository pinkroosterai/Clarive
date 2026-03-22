using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clarive.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddTrigramIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("CREATE EXTENSION IF NOT EXISTS pg_trgm;");

            migrationBuilder.Sql(
                """
                CREATE INDEX CONCURRENTLY ix_prompt_entries_title_trgm
                    ON prompt_entries USING GIN (title gin_trgm_ops);
                """);

            migrationBuilder.Sql(
                """
                CREATE INDEX CONCURRENTLY ix_users_name_trgm
                    ON users USING GIN (name gin_trgm_ops);
                """);

            migrationBuilder.Sql(
                """
                CREATE INDEX CONCURRENTLY ix_users_email_trgm
                    ON users USING GIN (email gin_trgm_ops);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_prompt_entries_title_trgm;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_users_name_trgm;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_users_email_trgm;");
        }
    }
}

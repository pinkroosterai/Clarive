using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clarive.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAiUsageLogUserIdIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "ix_ai_usage_logs_user_id",
                table: "ai_usage_logs",
                column: "user_id"
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(name: "ix_ai_usage_logs_user_id", table: "ai_usage_logs");
        }
    }
}

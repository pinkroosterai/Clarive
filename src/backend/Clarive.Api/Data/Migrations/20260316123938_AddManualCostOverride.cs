using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clarive.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddManualCostOverride : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "has_manual_cost_override",
                table: "ai_provider_models",
                type: "boolean",
                nullable: false,
                defaultValue: false
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "has_manual_cost_override",
                table: "ai_provider_models"
            );
        }
    }
}

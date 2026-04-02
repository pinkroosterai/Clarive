using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clarive.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddProviderCustomHeadersAndPricing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "custom_headers",
                table: "ai_providers",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "use_provider_pricing",
                table: "ai_providers",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "custom_headers",
                table: "ai_providers");

            migrationBuilder.DropColumn(
                name: "use_provider_pricing",
                table: "ai_providers");
        }
    }
}

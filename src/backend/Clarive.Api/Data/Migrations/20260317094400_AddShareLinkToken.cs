using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clarive.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddShareLinkToken : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "token",
                table: "share_links",
                type: "text",
                nullable: false,
                defaultValue: ""
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "token", table: "share_links");
        }
    }
}

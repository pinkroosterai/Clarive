using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Clarive.Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "service_config",
                columns: table => new
                {
                    key = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    encrypted_value = table.Column<string>(type: "text", nullable: true),
                    is_encrypted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_by = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_service_config", x => x.key);
                });

            migrationBuilder.CreateTable(
                name: "system_config",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    maintenance_enabled = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    maintenance_since = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    maintenance_by = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_system_config", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ai_sessions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    draft = table.Column<string>(type: "jsonb", nullable: false),
                    questions = table.Column<string>(type: "jsonb", nullable: false),
                    enhancements = table.Column<string>(type: "jsonb", nullable: false),
                    score_history = table.Column<string>(type: "jsonb", nullable: false),
                    config = table.Column<string>(type: "jsonb", nullable: true),
                    agent_session_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ai_sessions", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "api_keys",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    key_hash = table.Column<string>(type: "text", nullable: false),
                    key_prefix = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_api_keys", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "audit_log_entries",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    action = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    entity_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    entity_title = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    timestamp = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    details = table.Column<string>(type: "text", nullable: true),
                    expires_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_audit_log_entries", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "email_verification_tokens",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    token_hash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    expires_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    used_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_email_verification_tokens", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "folders",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    parent_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_folders", x => x.id);
                    table.ForeignKey(
                        name: "FK_folders_folders_parent_id",
                        column: x => x.parent_id,
                        principalTable: "folders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "invitations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    role = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    token_hash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    invited_by_id = table.Column<Guid>(type: "uuid", nullable: false),
                    target_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    expires_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_invitations", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "login_sessions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    refresh_token_id = table.Column<Guid>(type: "uuid", nullable: false),
                    ip_address = table.Column<string>(type: "character varying(45)", maxLength: 45, nullable: false),
                    user_agent = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false, defaultValue: ""),
                    browser = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false, defaultValue: ""),
                    os = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false, defaultValue: ""),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_login_sessions", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "password_reset_tokens",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    token_hash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    expires_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    used_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_password_reset_tokens", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "prompt_entries",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    folder_id = table.Column<Guid>(type: "uuid", nullable: true),
                    is_trashed = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_prompt_entries", x => x.id);
                    table.ForeignKey(
                        name: "FK_prompt_entries_folders_folder_id",
                        column: x => x.folder_id,
                        principalTable: "folders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "prompt_entry_versions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    entry_id = table.Column<Guid>(type: "uuid", nullable: false),
                    version = table.Column<int>(type: "integer", nullable: false),
                    version_state = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    system_message = table.Column<string>(type: "text", nullable: true),
                    published_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    published_by = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_prompt_entry_versions", x => x.id);
                    table.ForeignKey(
                        name: "FK_prompt_entry_versions_prompt_entries_entry_id",
                        column: x => x.entry_id,
                        principalTable: "prompt_entries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "prompts",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    version_id = table.Column<Guid>(type: "uuid", nullable: false),
                    content = table.Column<string>(type: "text", nullable: false),
                    order = table.Column<int>(name: "\"order\"", type: "integer", nullable: false),
                    is_template = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_prompts", x => x.id);
                    table.ForeignKey(
                        name: "FK_prompts_prompt_entry_versions_version_id",
                        column: x => x.version_id,
                        principalTable: "prompt_entry_versions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "template_fields",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    prompt_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    enum_values = table.Column<List<string>>(type: "text[]", nullable: true),
                    default_value = table.Column<string>(type: "text", nullable: true),
                    min = table.Column<double>(type: "double precision", nullable: true),
                    max = table.Column<double>(type: "double precision", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_template_fields", x => x.id);
                    table.ForeignKey(
                        name: "FK_template_fields_prompts_prompt_id",
                        column: x => x.prompt_id,
                        principalTable: "prompts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "refresh_tokens",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    token_hash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    expires_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    revoked_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    replaced_by_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_refresh_tokens", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "tenant_memberships",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    role = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    is_personal = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    joined_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tenant_memberships", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "tenants",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    owner_id = table.Column<Guid>(type: "uuid", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    delete_scheduled_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    avatar_path = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tenants", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "tool_descriptions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    tool_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    description = table.Column<string>(type: "text", nullable: false),
                    input_schema = table.Column<string>(type: "jsonb", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tool_descriptions", x => x.id);
                    table.ForeignKey(
                        name: "FK_tool_descriptions_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    password_hash = table.Column<string>(type: "text", nullable: true),
                    role = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    email_verified = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    google_id = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    delete_scheduled_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    onboarding_completed = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    avatar_path = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    is_super_user = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    theme_preference = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.id);
                    table.ForeignKey(
                        name: "FK_users_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "system_config",
                columns: new[] { "id", "maintenance_by", "maintenance_since" },
                values: new object[] { 1, null, null });

            migrationBuilder.CreateIndex(
                name: "ix_ai_sessions_tenant_id",
                table: "ai_sessions",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_api_keys_tenant_id",
                table: "api_keys",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "uq_api_keys_key_hash",
                table: "api_keys",
                column: "key_hash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_expires",
                table: "audit_log_entries",
                column: "expires_at");

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_tenant_timestamp",
                table: "audit_log_entries",
                columns: new[] { "tenant_id", "timestamp" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "ix_email_verification_user_id",
                table: "email_verification_tokens",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "uq_email_verification_token_hash",
                table: "email_verification_tokens",
                column: "token_hash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_folders_parent_id",
                table: "folders",
                column: "parent_id");

            migrationBuilder.CreateIndex(
                name: "ix_folders_tenant_id",
                table: "folders",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_folders_tenant_parent",
                table: "folders",
                columns: new[] { "tenant_id", "parent_id" });

            migrationBuilder.CreateIndex(
                name: "IX_invitations_invited_by_id",
                table: "invitations",
                column: "invited_by_id");

            migrationBuilder.CreateIndex(
                name: "ix_invitations_target_user_id",
                table: "invitations",
                column: "target_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_invitations_tenant_id",
                table: "invitations",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "uq_invitations_token_hash",
                table: "invitations",
                column: "token_hash",
                unique: true,
                filter: "\"token_hash\" != ''");

            migrationBuilder.CreateIndex(
                name: "ix_login_sessions_created_at",
                table: "login_sessions",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "ix_login_sessions_user_id",
                table: "login_sessions",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "uq_login_sessions_refresh_token",
                table: "login_sessions",
                column: "refresh_token_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_password_reset_user_id",
                table: "password_reset_tokens",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "uq_password_reset_token_hash",
                table: "password_reset_tokens",
                column: "token_hash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_prompt_entries_created_by",
                table: "prompt_entries",
                column: "created_by");

            migrationBuilder.CreateIndex(
                name: "IX_prompt_entries_folder_id",
                table: "prompt_entries",
                column: "folder_id");

            migrationBuilder.CreateIndex(
                name: "ix_prompt_entries_tenant_folder",
                table: "prompt_entries",
                columns: new[] { "tenant_id", "folder_id", "updated_at" },
                descending: new[] { false, false, true },
                filter: "NOT is_trashed");

            migrationBuilder.CreateIndex(
                name: "ix_prompt_entries_tenant_id",
                table: "prompt_entries",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_prompt_entries_tenant_trash",
                table: "prompt_entries",
                columns: new[] { "tenant_id", "updated_at" },
                descending: new[] { false, true },
                filter: "is_trashed");

            migrationBuilder.CreateIndex(
                name: "ix_prompt_entry_versions_entry",
                table: "prompt_entry_versions",
                column: "entry_id");

            migrationBuilder.CreateIndex(
                name: "ix_prompt_entry_versions_entry_state",
                table: "prompt_entry_versions",
                columns: new[] { "entry_id", "version_state" });

            migrationBuilder.CreateIndex(
                name: "IX_prompt_entry_versions_published_by",
                table: "prompt_entry_versions",
                column: "published_by");

            migrationBuilder.CreateIndex(
                name: "uq_prompt_entry_versions_entry_version",
                table: "prompt_entry_versions",
                columns: new[] { "entry_id", "version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_prompts_version",
                table: "prompts",
                column: "version_id");

            migrationBuilder.CreateIndex(
                name: "ix_refresh_tokens_expires",
                table: "refresh_tokens",
                column: "expires_at");

            migrationBuilder.CreateIndex(
                name: "ix_refresh_tokens_user_active",
                table: "refresh_tokens",
                column: "user_id",
                filter: "revoked_at IS NULL");

            migrationBuilder.CreateIndex(
                name: "uq_refresh_tokens_token_hash",
                table: "refresh_tokens",
                column: "token_hash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_template_fields_prompt",
                table: "template_fields",
                column: "prompt_id");

            migrationBuilder.CreateIndex(
                name: "ix_tenant_memberships_tenant_id",
                table: "tenant_memberships",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_tenant_memberships_user_id",
                table: "tenant_memberships",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "uq_tenant_memberships_user_tenant",
                table: "tenant_memberships",
                columns: new[] { "user_id", "tenant_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_tenants_owner_id",
                table: "tenants",
                column: "owner_id");

            migrationBuilder.CreateIndex(
                name: "ix_tool_descriptions_tenant_id",
                table: "tool_descriptions",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "ix_users_tenant_id",
                table: "users",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "uq_users_email",
                table: "users",
                column: "email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "uq_users_google_id",
                table: "users",
                column: "google_id",
                unique: true,
                filter: "google_id IS NOT NULL");

            migrationBuilder.AddForeignKey(
                name: "FK_ai_sessions_tenants_tenant_id",
                table: "ai_sessions",
                column: "tenant_id",
                principalTable: "tenants",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_api_keys_tenants_tenant_id",
                table: "api_keys",
                column: "tenant_id",
                principalTable: "tenants",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_audit_log_entries_tenants_tenant_id",
                table: "audit_log_entries",
                column: "tenant_id",
                principalTable: "tenants",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_email_verification_tokens_users_user_id",
                table: "email_verification_tokens",
                column: "user_id",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_folders_tenants_tenant_id",
                table: "folders",
                column: "tenant_id",
                principalTable: "tenants",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_invitations_tenants_tenant_id",
                table: "invitations",
                column: "tenant_id",
                principalTable: "tenants",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_invitations_users_invited_by_id",
                table: "invitations",
                column: "invited_by_id",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_invitations_users_target_user_id",
                table: "invitations",
                column: "target_user_id",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_login_sessions_refresh_tokens_refresh_token_id",
                table: "login_sessions",
                column: "refresh_token_id",
                principalTable: "refresh_tokens",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_login_sessions_users_user_id",
                table: "login_sessions",
                column: "user_id",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_password_reset_tokens_users_user_id",
                table: "password_reset_tokens",
                column: "user_id",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_prompt_entries_tenants_tenant_id",
                table: "prompt_entries",
                column: "tenant_id",
                principalTable: "tenants",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_prompt_entries_users_created_by",
                table: "prompt_entries",
                column: "created_by",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_prompt_entry_versions_users_published_by",
                table: "prompt_entry_versions",
                column: "published_by",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_refresh_tokens_users_user_id",
                table: "refresh_tokens",
                column: "user_id",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_tenant_memberships_tenants_tenant_id",
                table: "tenant_memberships",
                column: "tenant_id",
                principalTable: "tenants",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_tenant_memberships_users_user_id",
                table: "tenant_memberships",
                column: "user_id",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_tenants_users_owner_id",
                table: "tenants",
                column: "owner_id",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_users_tenants_tenant_id",
                table: "users");

            migrationBuilder.DropTable(
                name: "ai_sessions");

            migrationBuilder.DropTable(
                name: "api_keys");

            migrationBuilder.DropTable(
                name: "audit_log_entries");

            migrationBuilder.DropTable(
                name: "email_verification_tokens");

            migrationBuilder.DropTable(
                name: "invitations");

            migrationBuilder.DropTable(
                name: "login_sessions");

            migrationBuilder.DropTable(
                name: "password_reset_tokens");

            migrationBuilder.DropTable(
                name: "service_config");

            migrationBuilder.DropTable(
                name: "system_config");

            migrationBuilder.DropTable(
                name: "template_fields");

            migrationBuilder.DropTable(
                name: "tenant_memberships");

            migrationBuilder.DropTable(
                name: "tool_descriptions");

            migrationBuilder.DropTable(
                name: "refresh_tokens");

            migrationBuilder.DropTable(
                name: "prompts");

            migrationBuilder.DropTable(
                name: "prompt_entry_versions");

            migrationBuilder.DropTable(
                name: "prompt_entries");

            migrationBuilder.DropTable(
                name: "folders");

            migrationBuilder.DropTable(
                name: "tenants");

            migrationBuilder.DropTable(
                name: "users");
        }
    }
}

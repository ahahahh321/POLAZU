CREATE TABLE app_user (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(254) NOT NULL,
    password_hash VARCHAR(512) NOT NULL,
    display_name VARCHAR(80) NOT NULL,
    nickname VARCHAR(40) NOT NULL,
    profile_image_url VARCHAR(1000) NULL,
    locale VARCHAR(12) NOT NULL DEFAULT 'ko',
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT uq_app_user_email UNIQUE (email),
    CONSTRAINT uq_app_user_nickname UNIQUE (nickname)
);

CREATE TABLE auth_session (
    id CHAR(36) PRIMARY KEY,
    user_id BIGINT NOT NULL,
    token_hash CHAR(64) NOT NULL,
    expires_at TIMESTAMP(6) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    last_seen_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT uq_auth_session_token UNIQUE (token_hash),
    CONSTRAINT fk_auth_session_user FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE
);
CREATE INDEX ix_auth_session_expiry ON auth_session(expires_at);

CREATE TABLE project (
    id CHAR(36) PRIMARY KEY,
    owner_user_id BIGINT NOT NULL,
    name VARCHAR(120) NOT NULL,
    source_type VARCHAR(20) NOT NULL,
    repository_owner VARCHAR(100) NULL,
    repository_name VARCHAR(100) NULL,
    repository_url VARCHAR(500) NULL,
    default_branch VARCHAR(120) NULL,
    workspace_branch VARCHAR(120) NOT NULL,
    base_commit VARCHAR(64) NULL,
    last_remote_commit VARCHAR(64) NULL,
    framework VARCHAR(32) NOT NULL,
    skipped_file_count INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    current_revision BIGINT NOT NULL DEFAULT 0,
    published_revision BIGINT NOT NULL DEFAULT -1,
    storage_bytes BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    archived_at TIMESTAMP(6) NULL,
    deleted_at TIMESTAMP(6) NULL,
    CONSTRAINT fk_project_owner FOREIGN KEY (owner_user_id) REFERENCES app_user(id)
);
CREATE INDEX ix_project_owner_status ON project(owner_user_id, status, updated_at);

CREATE TABLE project_member (
    project_id CHAR(36) NOT NULL,
    user_id BIGINT NOT NULL,
    role VARCHAR(16) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (project_id, user_id),
    CONSTRAINT fk_project_member_project FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE,
    CONSTRAINT fk_project_member_user FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE
);
CREATE INDEX ix_project_member_user ON project_member(user_id, role);

CREATE TABLE workspace_file (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    project_id CHAR(36) NOT NULL,
    branch_name VARCHAR(120) NOT NULL,
    path VARCHAR(1024) NOT NULL,
    path_hash CHAR(64) NOT NULL,
    text_content MEDIUMTEXT NULL,
    binary_content LONGBLOB NULL,
    is_binary BOOLEAN NOT NULL DEFAULT FALSE,
    content_sha CHAR(64) NOT NULL,
    size_bytes BIGINT NOT NULL,
    updated_revision BIGINT NOT NULL DEFAULT 0,
    updated_by BIGINT NULL,
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT uq_workspace_file UNIQUE (project_id, branch_name, path_hash),
    CONSTRAINT fk_workspace_file_project FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE,
    CONSTRAINT fk_workspace_file_user FOREIGN KEY (updated_by) REFERENCES app_user(id) ON DELETE SET NULL
);
CREATE INDEX ix_workspace_file_project ON workspace_file(project_id, branch_name);

CREATE TABLE workspace_revision (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    project_id CHAR(36) NOT NULL,
    branch_name VARCHAR(120) NOT NULL,
    revision_no BIGINT NOT NULL,
    base_revision BIGINT NOT NULL,
    author_user_id BIGINT NULL,
    kind VARCHAR(24) NOT NULL,
    summary VARCHAR(500) NOT NULL,
    client_mutation_id VARCHAR(100) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT uq_workspace_revision UNIQUE (project_id, branch_name, revision_no),
    CONSTRAINT uq_workspace_mutation UNIQUE (project_id, client_mutation_id),
    CONSTRAINT fk_workspace_revision_project FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE,
    CONSTRAINT fk_workspace_revision_user FOREIGN KEY (author_user_id) REFERENCES app_user(id) ON DELETE SET NULL
);
CREATE INDEX ix_workspace_revision_project ON workspace_revision(project_id, branch_name, revision_no);

CREATE TABLE workspace_revision_change (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    revision_id BIGINT NOT NULL,
    path VARCHAR(1024) NOT NULL,
    path_hash CHAR(64) NOT NULL,
    change_type VARCHAR(16) NOT NULL,
    before_sha CHAR(64) NULL,
    after_sha CHAR(64) NULL,
    before_text MEDIUMTEXT NULL,
    after_text MEDIUMTEXT NULL,
    before_binary LONGBLOB NULL,
    after_binary LONGBLOB NULL,
    is_binary BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_revision_change_revision FOREIGN KEY (revision_id) REFERENCES workspace_revision(id) ON DELETE CASCADE
);
CREATE INDEX ix_revision_change_revision ON workspace_revision_change(revision_id);
CREATE INDEX ix_revision_change_path ON workspace_revision_change(path_hash);

CREATE TABLE internal_version (
    id CHAR(36) PRIMARY KEY,
    project_id CHAR(36) NOT NULL,
    branch_name VARCHAR(120) NOT NULL,
    source_revision BIGINT NOT NULL,
    name VARCHAR(100) NOT NULL,
    summary VARCHAR(500) NOT NULL,
    author_user_id BIGINT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_internal_version_project FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE,
    CONSTRAINT fk_internal_version_user FOREIGN KEY (author_user_id) REFERENCES app_user(id) ON DELETE SET NULL
);
CREATE INDEX ix_internal_version_project ON internal_version(project_id, branch_name, created_at);

CREATE TABLE internal_version_file (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    version_id CHAR(36) NOT NULL,
    path VARCHAR(1024) NOT NULL,
    path_hash CHAR(64) NOT NULL,
    text_content MEDIUMTEXT NULL,
    binary_content LONGBLOB NULL,
    is_binary BOOLEAN NOT NULL DEFAULT FALSE,
    content_sha CHAR(64) NOT NULL,
    size_bytes BIGINT NOT NULL,
    CONSTRAINT uq_internal_version_file UNIQUE (version_id, path_hash),
    CONSTRAINT fk_internal_version_file_version FOREIGN KEY (version_id) REFERENCES internal_version(id) ON DELETE CASCADE
);

CREATE TABLE project_comment (
    id CHAR(36) PRIMARY KEY,
    project_id CHAR(36) NOT NULL,
    branch_name VARCHAR(120) NOT NULL,
    file_path VARCHAR(1024) NULL,
    selector VARCHAR(1200) NULL,
    body VARCHAR(4000) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'OPEN',
    author_user_id BIGINT NOT NULL,
    resolved_by BIGINT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    resolved_at TIMESTAMP(6) NULL,
    CONSTRAINT fk_project_comment_project FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE,
    CONSTRAINT fk_project_comment_author FOREIGN KEY (author_user_id) REFERENCES app_user(id),
    CONSTRAINT fk_project_comment_resolver FOREIGN KEY (resolved_by) REFERENCES app_user(id) ON DELETE SET NULL
);
CREATE INDEX ix_project_comment_project ON project_comment(project_id, branch_name, status, created_at);

CREATE TABLE git_operation (
    id CHAR(36) PRIMARY KEY,
    project_id CHAR(36) NOT NULL,
    idempotency_key VARCHAR(100) NOT NULL,
    operation_type VARCHAR(24) NOT NULL,
    status VARCHAR(24) NOT NULL,
    source_revision BIGINT NOT NULL,
    repository_url VARCHAR(500) NOT NULL,
    base_branch VARCHAR(120) NOT NULL,
    remote_branch VARCHAR(120) NOT NULL,
    commit_sha VARCHAR(64) NULL,
    pull_request_url VARCHAR(1000) NULL,
    error_code VARCHAR(80) NULL,
    error_message VARCHAR(1000) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT uq_git_operation_idempotency UNIQUE (project_id, idempotency_key),
    CONSTRAINT fk_git_operation_project FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE
);
CREATE INDEX ix_git_operation_project ON git_operation(project_id, created_at);

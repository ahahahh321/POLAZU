CREATE TABLE app_schema_info (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    schema_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO app_schema_info (schema_name) VALUES ('interface-lab');

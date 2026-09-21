package com.interfacelab.backend.auth.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "members")
public class Member {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, unique = true, length = 191)
	private String email;

	@Column(length = 255)
	private String password;

	@Column(nullable = false, length = 100)
	private String name;

	@Column(nullable = false, length = 50)
	private String nickname;

	@Column(name = "profile_image_url", length = 500)
	private String profileImageUrl;

	@Column(nullable = false, length = 20)
	private String role;

	@Column(nullable = false, length = 20)
	private String provider;

	@Column(name = "provider_id", length = 100)
	private String providerId;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	protected Member() {
	}

	public Member(String email, String password, String name, String nickname, String profileImageUrl, String role, String provider, String providerId) {
		this.email = email;
		this.password = password;
		this.name = name;
		this.nickname = nickname;
		this.profileImageUrl = profileImageUrl;
		this.role = role != null ? role : "ROLE_USER";
		this.provider = provider != null ? provider : "LOCAL";
		this.providerId = providerId;
	}

	@PrePersist
	public void prePersist() {
		Instant now = Instant.now();
		if (this.createdAt == null) {
			this.createdAt = now;
		}
		if (this.updatedAt == null) {
			this.updatedAt = now;
		}
	}

	@PreUpdate
	public void preUpdate() {
		this.updatedAt = Instant.now();
	}

	public Long getId() {
		return id;
	}

	public String getEmail() {
		return email;
	}

	public String getPassword() {
		return password;
	}

	public String getName() {
		return name;
	}

	public String getNickname() {
		return nickname;
	}

	public String getProfileImageUrl() {
		return profileImageUrl;
	}

	public String getRole() {
		return role;
	}

	public String getProvider() {
		return provider;
	}

	public String getProviderId() {
		return providerId;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}

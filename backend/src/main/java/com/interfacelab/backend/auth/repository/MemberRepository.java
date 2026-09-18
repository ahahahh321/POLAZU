package com.interfacelab.backend.auth.repository;

import java.util.Optional;
import com.interfacelab.backend.auth.domain.Member;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MemberRepository extends JpaRepository<Member, Long> {
	Optional<Member> findByEmail(String email);
	boolean existsByEmail(String email);
	boolean existsByNickname(String nickname);
}

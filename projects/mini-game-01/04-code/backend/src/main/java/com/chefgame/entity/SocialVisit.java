package com.chefgame.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 社交拜访实体
 */
@Data
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "social_visit")
public class SocialVisit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 拜访者UID */
    @Column(name = "visitor_uid", nullable = false, length = 32)
    private String visitorUid;

    /** 被拜访者UID */
    @Column(name = "host_uid", nullable = false, length = 32)
    private String hostUid;

    /** 是否已点赞 */
    @Column(nullable = false)
    @Builder.Default
    private Boolean liked = false;

    /** 拜访时间 */
    @Column(name = "visited_at", nullable = false)
    private LocalDateTime visitedAt;

    @PrePersist
    protected void onCreate() {
        if (this.visitedAt == null) {
            this.visitedAt = LocalDateTime.now();
        }
    }
}

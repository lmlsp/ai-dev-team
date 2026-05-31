package com.chefgame.repository;

import com.chefgame.entity.SocialVisit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;

/**
 * 社交拜访 Repository
 */
@Repository
public interface SocialVisitRepository extends JpaRepository<SocialVisit, Long> {

    /**
     * 统计用户今日拜访次数
     */
    @Query("SELECT COUNT(s) FROM SocialVisit s WHERE s.visitorUid = :uid AND s.visitedAt >= :todayStart")
    long countTodayVisits(@Param("uid") String uid, @Param("todayStart") LocalDateTime todayStart);

    /**
     * 检查今日是否已拜访过某用户
     */
    @Query("SELECT COUNT(s) FROM SocialVisit s WHERE s.visitorUid = :visitorUid " +
           "AND s.hostUid = :hostUid AND s.visitedAt >= :todayStart")
    long countTodayVisitToHost(@Param("visitorUid") String visitorUid,
                               @Param("hostUid") String hostUid,
                               @Param("todayStart") LocalDateTime todayStart);

    /**
     * 统计某用户收到的点赞数
     */
    long countByHostUidAndLikedTrue(String hostUid);
}

package com.chefgame.repository;

import com.chefgame.entity.AdWatchLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;

/**
 * 广告观看日志 Repository
 */
@Repository
public interface AdWatchLogRepository extends JpaRepository<AdWatchLog, Long> {

    /**
     * 统计用户今日某场景的广告观看次数
     */
    @Query("SELECT COUNT(a) FROM AdWatchLog a WHERE a.uid = :uid AND a.scene = :scene " +
           "AND a.watchedAt >= :todayStart AND a.rewarded = true")
    long countTodayByUidAndScene(@Param("uid") String uid,
                                  @Param("scene") String scene,
                                  @Param("todayStart") LocalDateTime todayStart);

    /**
     * 通过交易ID查重
     */
    @Query("SELECT COUNT(a) FROM AdWatchLog a WHERE a.transId = :transId")
    long countByTransId(@Param("transId") String transId);
}

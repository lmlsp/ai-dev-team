package com.chefgame.repository;

import com.chefgame.entity.MergeLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;

/**
 * 合成日志 Repository
 */
@Repository
public interface MergeLogRepository extends JpaRepository<MergeLog, Long> {

    /**
     * 统计用户在某时间段内的合成次数（用于频率校验）
     */
    @Query("SELECT COUNT(m) FROM MergeLog m WHERE m.uid = :uid AND m.createdAt >= :since")
    long countByUidSince(@Param("uid") String uid, @Param("since") LocalDateTime since);
}

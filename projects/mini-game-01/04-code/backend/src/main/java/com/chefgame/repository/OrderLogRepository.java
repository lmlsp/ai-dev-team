package com.chefgame.repository;

import com.chefgame.entity.OrderLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * 订单日志 Repository
 */
@Repository
public interface OrderLogRepository extends JpaRepository<OrderLog, Long> {

    Page<OrderLog> findByUidOrderByServedAtDesc(String uid, Pageable pageable);
}

package com.chefgame.security;

import com.chefgame.common.GameException;
import com.chefgame.dto.request.BoardSyncRequest;
import com.chefgame.dto.request.MergeRequest;
import com.chefgame.dto.request.ServeOrderRequest;
import com.chefgame.repository.MergeLogRepository;
import com.chefgame.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * 防作弊 AOP 切面 — 关键操作的服务端校验
 */
@Slf4j
@Aspect
@Component
@RequiredArgsConstructor
public class AntiCheatAspect {

    private final MergeLogRepository mergeLogRepository;
    private final UserRepository userRepository;

    /**
     * 拦截合成操作
     */
    @Around("execution(* com.chefgame.service.MergeService.validateAndMerge(..))")
    public Object validateMerge(ProceedingJoinPoint pjp) throws Throwable {
        Object[] args = pjp.getArgs();
        String uid = (String) args[0];
        MergeRequest request = (MergeRequest) args[1];

        // 规则 1：频率校验（1分钟内合成不超过 120 次）
        long mergeCount = mergeLogRepository.countByUidSince(
                uid, LocalDateTime.now().minusMinutes(1));
        if (mergeCount > 120) {
            log.warn("合成频率异常: uid={}, count={}/min", uid, mergeCount);
            throw new GameException(20003, "操作过于频繁，请稍后再试");
        }

        // 规则 2：时间戳校验
        if (request.getTimestamp() != null) {
            long now = System.currentTimeMillis();
            if (request.getTimestamp() > now + 10000) {
                log.warn("时间戳超前: uid={}, ts={}, now={}", uid, request.getTimestamp(), now);
                throw new GameException(20002, "操作时间戳异常");
            }
        }

        return pjp.proceed();
    }

    /**
     * 拦截棋盘同步操作
     */
    @Around("execution(* com.chefgame.service.BoardService.syncBoard(..))")
    public Object validateSync(ProceedingJoinPoint pjp) throws Throwable {
        Object[] args = pjp.getArgs();
        String uid = (String) args[0];
        BoardSyncRequest request = (BoardSyncRequest) args[1];

        if (request.getOperations() != null) {
            // 单次同步操作数量上限
            if (request.getOperations().size() > 100) {
                log.warn("单次同步操作过多: uid={}, count={}", uid, request.getOperations().size());
                throw new GameException(20003, "同步数据量异常，请分批同步");
            }

            // 逐个校验操作时间戳
            long now = System.currentTimeMillis();
            for (var op : request.getOperations()) {
                if (op.getTimestamp() != null) {
                    if (op.getTimestamp() > now + 10000) {
                        log.warn("同步时间戳超前: uid={}, ts={}", uid, op.getTimestamp());
                        throw new GameException(20002, "操作时间戳异常");
                    }
                }
            }
        }

        return pjp.proceed();
    }

    /**
     * 拦截上菜操作
     */
    @Around("execution(* com.chefgame.service.OrderService.serveOrder(..))")
    public Object validateServe(ProceedingJoinPoint pjp) throws Throwable {
        Object[] args = pjp.getArgs();
        String uid = (String) args[0];
        ServeOrderRequest request = (ServeOrderRequest) args[2];

        // 时间戳校验
        if (request.getTimestamp() != null) {
            long now = System.currentTimeMillis();
            if (request.getTimestamp() > now + 10000) {
                log.warn("上菜时间戳超前: uid={}, ts={}", uid, request.getTimestamp());
                throw new GameException(20002, "操作时间戳异常");
            }
        }

        return pjp.proceed();
    }

    /**
     * 拦截广告奖励操作
     */
    @Around("execution(* com.chefgame.service.AdService.clientWatchReport(..))")
    public Object validateAdWatch(ProceedingJoinPoint pjp) throws Throwable {
        Object[] args = pjp.getArgs();
        String uid = (String) args[0];

        // 验证用户存在性
        if (!userRepository.findByUid(uid).isPresent()) {
            log.warn("广告上报用户不存在: uid={}", uid);
            throw new GameException(10002, "用户不存在");
        }

        return pjp.proceed();
    }
}

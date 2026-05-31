package com.chefgame.service;

import cn.hutool.crypto.digest.DigestUtil;
import com.chefgame.common.GameException;
import com.chefgame.dto.request.AdCallbackRequest;
import com.chefgame.dto.response.AdRewardResponse;
import com.chefgame.entity.AdWatchLog;
import com.chefgame.entity.User;
import com.chefgame.repository.AdWatchLogRepository;
import com.chefgame.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.TimeUnit;

/**
 * 广告服务 — 广告回调验证、每日次数校验、奖励发放
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdService {

    private final AdWatchLogRepository adWatchLogRepository;
    private final UserRepository userRepository;
    private final EnergyService energyService;
    private final StringRedisTemplate stringRedisTemplate;

    @Value("${game.energy-ad-reward:30}")
    private int energyAdReward;

    @Value("${game.energy-ad-daily-limit:10}")
    private int energyAdDailyLimit;

    @Value("${game.ad-speedup-daily-limit:8}")
    private int speedupDailyLimit;

    @Value("${game.energy-max:100}")
    private int energyMax;

    private static final String AD_COUNT_KEY = "ad:count:";

    @Value("${ad.ylh.secret-key}")
    private String ylhSecretKey;

    /**
     * 客户端上报广告观看（用于统计和发奖校验）
     */
    @Transactional
    public AdRewardResponse clientWatchReport(String uid, AdCallbackRequest request) {
        String scene = request.getScene();
        int dailyLimit = getSceneLimit(scene);

        // 1. 校验每日上限
        long todayCount = getDailyWatchCount(uid, scene);
        if (todayCount >= dailyLimit) {
            log.warn("广告观看已达每日上限: uid={}, scene={}, count={}", uid, scene, todayCount);
            throw new GameException(20002, "今日该广告已达观看上限（" + dailyLimit + "次）");
        }

        // 2. 去重校验（Redis SETNX 原子操作，避免竞态条件）
        if (request.getTransId() != null && !request.getTransId().isBlank()) {
            Boolean firstTime = stringRedisTemplate.opsForValue()
                    .setIfAbsent("ad:dedup:" + request.getTransId(), "1", 7, TimeUnit.DAYS);
            if (Boolean.FALSE.equals(firstTime)) {
                log.warn("广告重复上报: uid={}, transId={}", uid, request.getTransId());
                throw new GameException(20002, "该广告已领取过奖励了");
            }
        }

        // 3. 记录日志
        AdWatchLog logEntry = AdWatchLog.builder()
                .uid(uid)
                .scene(scene)
                .platform(request.getAdPlatform() != null ? request.getAdPlatform() : "ylh")
                .transId(request.getTransId())
                .rewarded(false)
                .build();
        adWatchLogRepository.save(logEntry);

        // 4. 发放奖励
        grantRewardInternal(uid, scene);

        // 5. 更新计数
        String countKey = AD_COUNT_KEY + uid + ":" + scene + ":" + LocalDate.now();
        stringRedisTemplate.opsForValue().increment(countKey);
        stringRedisTemplate.expire(countKey, 1, TimeUnit.DAYS);

        logEntry.setRewarded(true);
        adWatchLogRepository.save(logEntry);

        log.info("广告奖励发放: uid={}, scene={}, dailyCount={}", uid, scene, todayCount + 1);

        return AdRewardResponse.builder()
                .reward(AdRewardResponse.RewardDetail.builder()
                        .type(getRewardType(scene))
                        .amount(getRewardAmount(scene))
                        .dailyCount(todayCount + 1)
                        .dailyLimit(dailyLimit)
                        .build())
                .build();
    }

    /**
     * 优量汇服务端回调验证（S2S）
     */
    @Transactional
    public void handleYlhCallback(AdCallbackRequest dto) {
        // 1. 验证签名（优量汇使用 MD5 签名）
        String expectedSign = DigestUtil.md5Hex(
                (dto.getAppId() != null ? dto.getAppId() : "")
                + (dto.getTransId() != null ? dto.getTransId() : "")
                + ylhSecretKey);

        if (!expectedSign.equalsIgnoreCase(dto.getSign())) {
            log.warn("优量汇回调签名验证失败: transId={}", dto.getTransId());
            throw new GameException(20004, "广告回调验签失败");
        }

        // 2. 防重复发放（Redis SETNX 原子操作）
        if (dto.getTransId() != null) {
            Boolean firstTime = stringRedisTemplate.opsForValue()
                    .setIfAbsent("ad:dedup:" + dto.getTransId(), "1", 7, TimeUnit.DAYS);
            if (Boolean.FALSE.equals(firstTime)) {
                log.info("广告回调重复（已发放）: transId={}", dto.getTransId());
                return;
            }
        }

        // 3. 记录日志
        AdWatchLog logEntry = AdWatchLog.builder()
                .uid(dto.getUid())
                .scene(dto.getScene())
                .platform("ylh")
                .transId(dto.getTransId())
                .rewarded(false)
                .build();
        adWatchLogRepository.save(logEntry);

        // 4. 发放奖励
        String uid = dto.getUid();
        String scene = dto.getScene();
        grantRewardInternal(uid, scene);

        logEntry.setRewarded(true);
        adWatchLogRepository.save(logEntry);

        log.info("优量汇S2S奖励发放: uid={}, scene={}, transId={}", uid, scene, dto.getTransId());
    }

    /**
     * 发放奖励
     */
    public void grantReward(String uid, String scene) {
        grantRewardInternal(uid, scene);
    }

    /**
     * 内部奖励发放逻辑
     */
    private void grantRewardInternal(String uid, String scene) {
        User user = userRepository.findByUid(uid)
                .orElseThrow(() -> new GameException(10002, "用户不存在"));

        switch (scene) {
            case "energy" -> {
                // 恢复 30 点能量
                energyService.addEnergy(uid, energyAdReward);
                log.info("广告奖励-能量: uid={}, amount={}", uid, energyAdReward);
            }
            case "speedup" -> {
                // 加速生成食材（由客户端处理生成逻辑，服务端记录即可）
                log.info("广告奖励-加速生成: uid={}", uid);
            }
            case "double_gold" -> {
                // 金币翻倍（在上菜流程中处理，此处仅记录）
                log.info("广告奖励-金币翻倍: uid={}", uid);
            }
            case "extend_time" -> {
                // 延长顾客等待时间（客户端处理）
                log.info("广告奖励-延长时间: uid={}", uid);
            }
            default -> {
                log.warn("未知广告场景: uid={}, scene={}", uid, scene);
                throw new GameException(20005, "不支持的广告场景: " + scene);
            }
        }
    }

    /**
     * 获取用户今日某场景广告观看次数
     */
    public long getDailyWatchCount(String uid, String scene) {
        // 先从 Redis 获取
        String countKey = AD_COUNT_KEY + uid + ":" + scene + ":" + LocalDate.now();
        String cacheCount = stringRedisTemplate.opsForValue().get(countKey);

        if (cacheCount != null) {
            return Long.parseLong(cacheCount);
        }

        // Redis miss，从 DB 查询
        LocalDateTime todayStart = LocalDateTime.of(LocalDate.now(), LocalTime.MIN);
        long dbCount = adWatchLogRepository.countTodayByUidAndScene(uid, scene, todayStart);

        // 写入 Redis
        stringRedisTemplate.opsForValue().set(countKey, String.valueOf(dbCount), 1, TimeUnit.DAYS);

        return dbCount;
    }

    /**
     * 获取场景对应的每日上限
     */
    private int getSceneLimit(String scene) {
        return switch (scene) {
            case "energy" -> energyAdDailyLimit;
            case "speedup" -> speedupDailyLimit;
            case "double_gold" -> 20; // 无硬性限制，设一个合理值
            case "extend_time" -> 5;
            default -> 10;
        };
    }

    /**
     * 获取奖励类型
     */
    private String getRewardType(String scene) {
        return switch (scene) {
            case "energy" -> "energy";
            case "speedup" -> "speedup";
            case "double_gold" -> "double_gold";
            case "extend_time" -> "extend_time";
            default -> scene;
        };
    }

    /**
     * 获取奖励数量
     */
    private int getRewardAmount(String scene) {
        return switch (scene) {
            case "energy" -> energyAdReward;
            case "speedup" -> 3;  // 3 个 Lv.1 食材
            case "double_gold" -> 0; // 实际金币翻倍由上菜流程决定
            case "extend_time" -> 30; // 延长 30 秒
            default -> 0;
        };
    }
}

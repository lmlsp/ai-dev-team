package com.chefgame.service;

import com.chefgame.common.GameException;
import com.chefgame.entity.User;
import com.chefgame.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 能量服务 — 消耗/恢复/服务端时间校验
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EnergyService {

    private final UserRepository userRepository;
    private final StringRedisTemplate stringRedisTemplate;

    @Value("${game.energy-max:100}")
    private int energyMax;

    @Value("${game.energy-recover-interval:180000}")
    private long recoverInterval; // 3分钟=180000ms

    @Value("${game.energy-recover-amount:1}")
    private int recoverAmount;

    private static final String ENERGY_KEY_PREFIX = "energy:";

    /**
     * 获取当前实际能量（服务端时间计算恢复量）
     */
    public int getEnergy(String uid) {
        // 优先从 Redis 读取
        String key = ENERGY_KEY_PREFIX + uid;
        String energyStr = (String) stringRedisTemplate.opsForHash().get(key, "energy");
        String tsStr = (String) stringRedisTemplate.opsForHash().get(key, "ts");

        int storedEnergy;
        long lastTs;

        if (energyStr != null && tsStr != null) {
            storedEnergy = Integer.parseInt(energyStr);
            lastTs = Long.parseLong(tsStr);
        } else {
            // Redis miss，从 DB 加载
            User user = userRepository.findByUid(uid)
                    .orElseThrow(() -> new GameException(10002, "用户不存在"));
            storedEnergy = user.getEnergy();
            lastTs = user.getEnergyTs();
            // 写入 Redis
            syncToRedis(uid, storedEnergy, lastTs);
        }

        return calculateCurrent(storedEnergy, lastTs);
    }

    /**
     * 消耗能量
     * @param uid 用户UID
     * @param amount 消耗量
     * @return 剩余能量
     */
    @Transactional
    public int consumeEnergy(String uid, int amount) {
        int current = getEnergy(uid);
        if (current < amount) {
            log.warn("能量不足: uid={}, current={}, need={}", uid, current, amount);
            throw new GameException(20001, "能量不足");
        }

        int after = current - amount;
        long now = System.currentTimeMillis();

        syncToRedis(uid, after, now);
        userRepository.updateEnergy(uid, after, now);

        log.info("消耗能量: uid={}, amount={}, remaining={}", uid, amount, after);
        return after;
    }

    /**
     * 增加能量（广告奖励等）
     * @return 新的能量值
     */
    @Transactional
    public int addEnergy(String uid, int amount) {
        int current = getEnergy(uid);
        int after = Math.min(energyMax, current + amount);
        long now = System.currentTimeMillis();

        syncToRedis(uid, after, now);
        userRepository.updateEnergy(uid, after, now);

        log.info("增加能量: uid={}, amount={}, after={}", uid, amount, after);
        return after;
    }

    /**
     * 获取能量恢复信息（给客户端展示倒计时用）
     */
    public EnergyInfo getEnergyInfo(String uid) {
        int current = getEnergy(uid);
        long nextRecoverIn = 0;
        if (current < energyMax) {
            String tsStr = (String) stringRedisTemplate.opsForHash().get(ENERGY_KEY_PREFIX + uid, "ts");
            long lastTs = tsStr != null ? Long.parseLong(tsStr) : System.currentTimeMillis();
            long elapsed = System.currentTimeMillis() - lastTs;
            nextRecoverIn = recoverInterval - (elapsed % recoverInterval);
        }

        return new EnergyInfo(current, energyMax, nextRecoverIn);
    }

    /**
     * 服务端时间计算实际能量（不含uid参数，只做纯计算）
     */
    private int calculateCurrent(int storedEnergy, long lastTs) {
        long now = System.currentTimeMillis();
        long elapsed = now - lastTs;
        int recovered = (int) (elapsed / recoverInterval);
        return Math.min(energyMax, storedEnergy + recovered);
    }

    private void syncToRedis(String uid, int energy, long ts) {
        String key = ENERGY_KEY_PREFIX + uid;
        stringRedisTemplate.opsForHash().put(key, "energy", String.valueOf(energy));
        stringRedisTemplate.opsForHash().put(key, "ts", String.valueOf(ts));
    }

    /**
     * 能量信息
     */
    public record EnergyInfo(int currentEnergy, int maxEnergy, long nextRecoverInMs) {}
}

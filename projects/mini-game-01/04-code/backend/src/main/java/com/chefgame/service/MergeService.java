package com.chefgame.service;

import com.chefgame.common.GameException;
import com.chefgame.dto.request.MergeRequest;
import com.chefgame.dto.response.MergeResponse;
import com.chefgame.entity.MergeLog;
import com.chefgame.repository.MergeLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * 合成服务 — 合成规则校验（防作弊：校验合成公式是否合法）
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MergeService {

    private final MergeLogRepository mergeLogRepository;
    private final EnergyService energyService;

    /**
     * 单次合成校验（关键操作即时同步）
     */
    @Transactional
    public MergeResponse validateAndMerge(String uid, MergeRequest request) {
        // 1. 校验合成合法性
        validateMergeRule(uid, request);

        // 2. 消耗能量
        int newEnergy = energyService.consumeEnergy(uid, request.getEnergyCost());

        // 3. 记录合成日志（反作弊审计）
        MergeLog logEntry = MergeLog.builder()
                .uid(uid)
                .fromItemType(request.getFromItem().getT())
                .fromLevel(request.getFromItem().getL())
                .toItemType(request.getToItem().getT())
                .toLevel(request.getToItem().getL())
                .resultType(request.getExpectedResult().getT())
                .resultLevel(request.getExpectedResult().getL())
                .build();
        mergeLogRepository.save(logEntry);

        log.info("合成成功: uid={}, {}:{} + {}:{} -> {}:{}",
                uid,
                request.getFromItem().getT(), request.getFromItem().getL(),
                request.getToItem().getT(), request.getToItem().getL(),
                request.getExpectedResult().getT(), request.getExpectedResult().getL());

        return MergeResponse.builder()
                .valid(true)
                .newEnergy(newEnergy)
                .newGold(0)
                .build();
    }

    /**
     * 校验合成规则合法性
     */
    private void validateMergeRule(String uid, MergeRequest request) {
        MergeRequest.CellItem from = request.getFromItem();
        MergeRequest.CellItem to = request.getToItem();
        MergeRequest.CellItem expected = request.getExpectedResult();

        // 规则 1：两个物品必须同类型
        if (!from.getT().equals(to.getT())) {
            log.warn("合成类型不匹配: uid={}, {} vs {}", uid, from.getT(), to.getT());
            throw new GameException(20001, "合成失败：物品类型不匹配");
        }

        // 规则 2：两个物品必须同等级
        if (!from.getL().equals(to.getL())) {
            log.warn("合成等级不一致: uid={}, {} vs {}", uid, from.getL(), to.getL());
            throw new GameException(20001, "合成失败：物品等级不一致");
        }

        // 规则 3：结果物品类型必须与原材料一致（线性链）或为合法跨品类结果
        boolean isLinearChain = expected.getT().equals(from.getT())
                && expected.getL() == from.getL() + 1;
        boolean isCrossRecipe = isValidCrossRecipe(from, to, expected);

        if (!isLinearChain && !isCrossRecipe) {
            log.warn("合成公式非法: uid={}, {}:{} + {}:{} -> {}:{}",
                    uid, from.getT(), from.getL(), to.getT(), to.getL(),
                    expected.getT(), expected.getL());
            throw new GameException(20001, "合成失败：合成公式不合法");
        }

        // 规则 4：时间戳校验（操作不能超前于服务端时间）
        if (request.getTimestamp() != null) {
            long now = System.currentTimeMillis();
            if (request.getTimestamp() > now + 10000) {
                throw new GameException(20002, "操作时间戳异常");
            }
        }

        // 规则 5：频率校验（1分钟内合成不超过120次）
        long mergeCountInMinute = mergeLogRepository.countByUidSince(
                uid, LocalDateTime.now().minusMinutes(1));
        if (mergeCountInMinute > 120) {
            log.warn("合成频率异常: uid={}, count={}", uid, mergeCountInMinute);
            throw new GameException(20003, "操作过于频繁，请稍后再试");
        }
    }

    /**
     * 检查是否为合法的跨品类合成配方
     * V1.0 预留跨品类合成逻辑，当前简单校验
     */
    private boolean isValidCrossRecipe(MergeRequest.CellItem from,
                                        MergeRequest.CellItem to,
                                        MergeRequest.CellItem expected) {
        // V1.0 阶段：大部分合成为线性链
        // 跨品类合成（如番茄酱Lv.2 + 炒蛋Lv.3 -> 番茄炒蛋）由配置表驱动
        // 这里做基础校验：跨品类时结果类型不同于输入类型
        if (!expected.getT().equals(from.getT()) && !expected.getT().equals(to.getT())) {
            // 跨品类合成：两个不同基础类型的合成品
            // 结果等级为0（成品菜品）
            return expected.getL() == 0;
        }
        return false;
    }

    /**
     * 获取用户合成历史统计
     */
    public long getRecentMergeCount(String uid) {
        return mergeLogRepository.countByUidSince(uid, LocalDateTime.now().minusMinutes(1));
    }
}

package com.chefgame.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 合成校验响应
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MergeResponse {

    /** 是否有效 */
    private Boolean valid;

    /** 新的能量值 */
    private Integer newEnergy;

    /** 获得金币（合成通常不直接产生金币） */
    private Integer newGold;

    /** 解锁的菜谱（如有新解锁） */
    private RecipeBrief unlockedRecipe;

    /** 成就（预留） */
    private String achievement;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RecipeBrief {
        private String chainId;
        private String name;
        private Integer level;
    }
}

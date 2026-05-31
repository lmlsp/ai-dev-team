package com.chefgame.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 餐厅响应
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RestaurantResponse {

    /** 当前等级 */
    private Integer level;

    /** 餐厅名称 */
    private String name;

    /** 升级条件 */
    private UpgradeCondition condition;

    /** 升级结果 */
    private UpgradeResult upgradeResult;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UpgradeCondition {
        private Integer currentLevel;
        private String currentName;
        private Integer nextLevel;
        private String nextName;
        private Integer goldRequired;
        private java.math.BigDecimal ratingRequired;
        private Boolean satisfied;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UpgradeResult {
        private Integer newLevel;
        private String newName;
        private List<RecipeBrief> unlockedRecipes;
        private Boolean boardExpanded;
        private List<String> unlockedFeatures;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RecipeBrief {
        private String chainId;
        private String name;
    }
}

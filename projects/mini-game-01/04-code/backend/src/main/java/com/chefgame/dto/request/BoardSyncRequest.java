package com.chefgame.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

/**
 * 棋盘同步请求
 */
@Data
public class BoardSyncRequest {

    /** 本地棋盘版本号（乐观锁） */
    @NotNull(message = "版本号不能为空")
    private Integer version;

    /** 批量操作列表 */
    private List<SyncOperation> operations;

    /** 客户端当前金币 */
    private Integer currentGold;

    /** 客户端当前能量 */
    private Integer currentEnergy;

    /** 客户端当前好评度 */
    private java.math.BigDecimal currentRating;

    /**
     * 单次操作
     */
    @Data
    public static class SyncOperation {
        /** 操作类型: merge / generate / sell / place */
        private String op;
        /** 客户端时间戳 */
        private Long timestamp;
        /** 源格子索引 */
        private Integer fromIdx;
        /** 目标格子索引 */
        private Integer toIdx;
        /** 源物品 */
        private CellItem fromItem;
        /** 目标物品 */
        private CellItem toItem;
        /** 合成结果物品 */
        private CellItem resultItem;
        /** 卖出格位索引 */
        private Integer idx;
        /** 卖出获得金币 */
        private Integer goldEarned;
        /** 售出的物品 */
        private CellItem item;
    }

    /**
     * 棋盘格子物品
     */
    @Data
    public static class CellItem {
        /** 物品类型 */
        private String t;
        /** 物品等级 */
        private Integer l;
        /** 物品实例ID */
        private Integer i;
    }
}

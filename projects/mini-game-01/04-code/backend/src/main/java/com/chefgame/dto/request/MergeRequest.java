package com.chefgame.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 合成请求（关键操作即时同步）
 */
@Data
public class MergeRequest {

    /** 操作时间戳 */
    @NotNull(message = "时间戳不能为空")
    private Long timestamp;

    /** 源格子索引 */
    @Min(value = 0, message = "源格位不合法")
    private Integer fromIdx;

    /** 目标格子索引 */
    @Min(value = 0, message = "目标格位不合法")
    private Integer toIdx;

    /** 源物品 */
    @NotNull(message = "源物品不能为空")
    private CellItem fromItem;

    /** 目标物品 */
    @NotNull(message = "目标物品不能为空")
    private CellItem toItem;

    /** 期望的合成结果 */
    @NotNull(message = "期望结果不能为空")
    private CellItem expectedResult;

    /** 能量消耗 */
    @Min(value = 1, message = "能量消耗异常")
    private Integer energyCost;

    @Data
    public static class CellItem {
        private String t;
        private Integer l;
    }
}

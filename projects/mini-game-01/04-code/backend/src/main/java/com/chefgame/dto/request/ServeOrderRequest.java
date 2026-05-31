package com.chefgame.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 上菜请求
 */
@Data
public class ServeOrderRequest {

    /** 操作时间戳 */
    @NotNull(message = "时间戳不能为空")
    private Long timestamp;

    /** 上菜物品 */
    @NotNull(message = "菜品不能为空")
    private CellItem servedItem;

    /** 菜品在棋盘的位置索引 */
    @Min(value = 0, message = "格位索引不合法")
    private Integer boardIdx;

    /** 顾客ID */
    @NotBlank(message = "顾客ID不能为空")
    private String customerId;

    /** 订单ID */
    @NotBlank(message = "订单ID不能为空")
    private String orderId;

    @Data
    public static class CellItem {
        private String t;
        private Integer l;
    }
}

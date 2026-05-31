package com.chefgame.service;

import cn.hutool.json.JSONArray;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.chefgame.common.GameException;
import com.chefgame.dto.request.BoardSyncRequest;
import com.chefgame.dto.response.BoardResponse;
import com.chefgame.dto.response.SyncResponse;
import com.chefgame.entity.BoardState;
import com.chefgame.entity.User;
import com.chefgame.repository.BoardRepository;
import com.chefgame.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * 棋盘服务 — 棋盘状态读写、增量同步（乐观锁版本号校验）
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BoardService {

    private final BoardRepository boardRepository;
    private final UserRepository userRepository;
    private final EnergyService energyService;

    @Value("${game.board-default-rows:6}")
    private int defaultRows;

    @Value("${game.board-default-cols:5}")
    private int defaultCols;

    /**
     * 获取棋盘完整状态
     */
    public BoardResponse getBoard(String uid) {
        BoardState board = boardRepository.findByUid(uid)
                .orElseThrow(() -> new GameException(11001, "棋盘数据不存在"));

        User user = userRepository.findByUid(uid)
                .orElseThrow(() -> new GameException(10002, "用户不存在"));

        int actualEnergy = energyService.getEnergy(uid);

        return BoardResponse.builder()
                .cells(board.getCells())
                .rows(board.getRows())
                .cols(board.getCols())
                .version(board.getVersion())
                .gold(user.getGold())
                .energy(actualEnergy)
                .rating(user.getRating())
                .restaurantLevel(user.getRestaurantLevel())
                .build();
    }

    /**
     * 增量同步棋盘变更（乐观锁校验）
     */
    @Transactional
    public SyncResponse syncBoard(String uid, BoardSyncRequest request) {
        BoardState current = boardRepository.findByUid(uid)
                .orElseThrow(() -> new GameException(11001, "棋盘数据不存在"));

        // 1. 乐观锁版本校验
        if (!current.getVersion().equals(request.getVersion())) {
            log.warn("版本冲突: uid={}, client={}, server={}", uid,
                    request.getVersion(), current.getVersion());
            throw new GameException(11002, "版本冲突，请拉取最新棋盘数据");
        }

        List<SyncResponse.Correction> corrections = new ArrayList<>();
        List<BoardSyncRequest.SyncOperation> ops = request.getOperations();

        if (ops != null && !ops.isEmpty()) {
            // 2. 逐个校验操作合法性
            for (BoardSyncRequest.SyncOperation op : ops) {
                try {
                    validateOperation(uid, op);
                } catch (GameException e) {
                    log.warn("操作校验失败: uid={}, op={}, reason={}", uid, op.getOp(), e.getMessage());
                    corrections.add(SyncResponse.Correction.builder()
                            .field(op.getOp())
                            .clientValue(op)
                            .build());
                }
            }

            // 3. 更新棋盘版本
            int newVersion = current.getVersion() + ops.size();
            current.setVersion(newVersion);

            // 4. 如果有完整的棋盘数据更新（从操作中推断棋盘状态）
            // 简化处理：只更新版本号，客户端下次 getBoard 会拉取全量
            boardRepository.save(current);
        }

        // 5. 校验资源一致性
        User user = userRepository.findByUid(uid)
                .orElseThrow(() -> new GameException(10002, "用户不存在"));

        int serverEnergy = energyService.getEnergy(uid);

        // 金币校验
        if (request.getCurrentGold() != null
                && !request.getCurrentGold().equals(user.getGold())) {
            corrections.add(SyncResponse.Correction.builder()
                    .field("gold")
                    .clientValue(request.getCurrentGold())
                    .serverValue(user.getGold())
                    .build());
        }

        // 能量校验
        if (request.getCurrentEnergy() != null
                && Math.abs(request.getCurrentEnergy() - serverEnergy) > 5) {
            corrections.add(SyncResponse.Correction.builder()
                    .field("energy")
                    .clientValue(request.getCurrentEnergy())
                    .serverValue(serverEnergy)
                    .build());
        }

        return SyncResponse.builder()
                .accepted(true)
                .newVersion(current.getVersion())
                .serverGold(user.getGold())
                .serverEnergy(serverEnergy)
                .serverRating(user.getRating())
                .corrections(corrections.isEmpty() ? null : corrections)
                .build();
    }

    /**
     * 校验单个操作
     */
    private void validateOperation(String uid, BoardSyncRequest.SyncOperation op) {
        // 时间戳校验：不能晚于服务端时间太多
        if (op.getTimestamp() != null) {
            long now = System.currentTimeMillis();
            if (op.getTimestamp() > now + 10000) {
                throw new GameException(20002, "操作时间戳异常");
            }
        }

        switch (op.getOp()) {
            case "merge" -> validateMergeOp(uid, op);
            case "sell" -> validateSellOp(op);
            case "place" -> validatePlaceOp(op);
            case "generate" -> validateGenerateOp(op);
            default -> throw new GameException(11003, "未知操作类型: " + op.getOp());
        }
    }

    private void validateMergeOp(String uid, BoardSyncRequest.SyncOperation op) {
        if (op.getFromItem() == null || op.getToItem() == null || op.getResultItem() == null) {
            throw new GameException(20002, "合成参数不完整");
        }
        // 校验合成合法性：两个相同物品合成
        if (!op.getFromItem().getT().equals(op.getToItem().getT())) {
            throw new GameException(20002, "合成类型不匹配");
        }
        if (!op.getFromItem().getL().equals(op.getToItem().getL())) {
            throw new GameException(20002, "合成等级不一致");
        }
        // 结果等级应为 from等级+1
        if (op.getResultItem().getL() != op.getFromItem().getL() + 1) {
            throw new GameException(20002, "合成结果等级异常");
        }
        // 能量消耗
        energyService.consumeEnergy(uid, 1);
    }

    private void validateSellOp(BoardSyncRequest.SyncOperation op) {
        if (op.getGoldEarned() == null || op.getGoldEarned() < 0) {
            throw new GameException(20002, "卖出金币异常");
        }
        // 卖出金币上限校验（Lv.0食材售价上限20金币）
        if (op.getGoldEarned() > 200) {
            throw new GameException(20002, "卖出金币超过上限");
        }
    }

    private void validatePlaceOp(BoardSyncRequest.SyncOperation op) {
        // 放置操作：基础校验
        if (op.getFromIdx() == null && op.getToIdx() == null) {
            throw new GameException(20002, "放置格位参数缺失");
        }
    }

    private void validateGenerateOp(BoardSyncRequest.SyncOperation op) {
        // 自动生成操作：只允许生成Lv.0食材
        if (op.getResultItem() != null && op.getResultItem().getL() != null
                && op.getResultItem().getL() > 0) {
            throw new GameException(20002, "自动生成物品等级异常");
        }
    }

    /**
     * 更新棋盘格子数据
     */
    @Transactional
    public void updateBoardCells(String uid, String cells, int rows, int cols, int oldVersion) {
        int newVersion = oldVersion + 1;
        int updated = boardRepository.updateBoard(uid, cells, rows, cols, newVersion, oldVersion);
        if (updated == 0) {
            throw new GameException(11002, "棋盘版本冲突，更新失败");
        }
    }
}

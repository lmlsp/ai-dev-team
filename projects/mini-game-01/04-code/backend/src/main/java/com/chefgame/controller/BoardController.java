package com.chefgame.controller;

import com.chefgame.common.Result;
import com.chefgame.dto.request.BoardSyncRequest;
import com.chefgame.dto.response.BoardResponse;
import com.chefgame.dto.response.SyncResponse;
import com.chefgame.service.BoardService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

/**
 * 棋盘 Controller
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/board")
@RequiredArgsConstructor
public class BoardController {

    private final BoardService boardService;

    /**
     * 获取棋盘完整状态
     * GET /api/v1/board
     */
    @GetMapping
    public Result<BoardResponse> getBoard(@RequestAttribute("uid") String uid) {
        log.info("获取棋盘: uid={}", uid);
        BoardResponse board = boardService.getBoard(uid);
        return Result.ok(board);
    }

    /**
     * 批量同步棋盘变更（增量）
     * POST /api/v1/board/sync
     */
    @PostMapping("/sync")
    public Result<SyncResponse> syncBoard(
            @RequestAttribute("uid") String uid,
            @Valid @RequestBody BoardSyncRequest request) {
        log.info("棋盘同步: uid={}, version={}, ops={}",
                uid, request.getVersion(),
                request.getOperations() != null ? request.getOperations().size() : 0);
        SyncResponse response = boardService.syncBoard(uid, request);
        return Result.ok(response);
    }
}

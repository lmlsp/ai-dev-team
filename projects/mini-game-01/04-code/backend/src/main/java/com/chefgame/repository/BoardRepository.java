package com.chefgame.repository;

import com.chefgame.entity.BoardState;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * 棋盘状态 Repository
 */
@Repository
public interface BoardRepository extends JpaRepository<BoardState, Long> {

    Optional<BoardState> findByUid(String uid);

    @Modifying
    @Transactional
    @Query("UPDATE BoardState b SET b.cells = :cells, b.rows = :rows, b.cols = :cols, " +
           "b.version = :version WHERE b.uid = :uid AND b.version = :oldVersion")
    int updateBoard(@Param("uid") String uid,
                    @Param("cells") String cells,
                    @Param("rows") Integer rows,
                    @Param("cols") Integer cols,
                    @Param("version") Integer version,
                    @Param("oldVersion") Integer oldVersion);
}

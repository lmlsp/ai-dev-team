# 项目目录规范

每个需求项目在 `projects/` 下按此结构组织：

```
projects/<project-name>/
├── 01-prd.md              # 产品经理输出
├── 02-architecture.md     # 架构师输出
├── 03-ui-design.md        # UI设计师输出（可选）
├── 04-code/               # 开发者输出（代码）
├── 05-review-report.md    # Code Reviewer输出
├── 06-qa-report.md        # QA测试输出
├── 07-deployment.md       # DevOps输出
└── README.md              # 项目概述（自动生成）
```

## 流转规则

1. 每个角色只读取上一个角色的输出文档（禁止读更早的文档）
2. 角色产出的文档写入对应序号文件
3. 完成一个角色后，自动触发下一个角色
4. 所有文档 git 版本化管理

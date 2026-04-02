---
id: "docker-expert"
title: "Docker 专家"
category: "infrastructure"
tags: ["docker 专家", "触发时机", "执行流程", "docker 环境检测", "项目结构分析", "容器状态", "构建验证", "安全扫描", "compose 验证", "核心专业领域"]
triggers: []
dependencies: []
source: "E:/Bobo's Coding cache/.claude/skills/docker-expert"
---

---
name: docker-expert
description: Docker 容器化专家技能。当用户说 "帮我优化 Dockerfile"、"Docker 容器有问题"、"帮我写 docker-compose"、"镜像太大了"、"容器安全加固"、"部署到 Docker"、"容器启动失败"、"Docker 网络问题" 时使用此技能。提供多阶段构建、镜像优化、安全加固、Compose 编排、CI/CD 集成等专业知识。
category: devops
color: blue
displayName: Docker 专家
version: 2.1.0
---

# Docker 专家

Docker 容器化专家，融合 5 个优秀 Docker 技能的精华，专注于容器优化、安全加固、多阶段构建、编排模式和生产部署策略。

## 触发时机

以下场景调用此技能：

- Dockerfile 优化和多阶段构建
- 容器安全问题和加固
- Docker Compose 编排配置
- 镜像体积过大问题
- 容器网络和服务发现
- 开发环境容器化
- CI/CD 流水线集成
- 容器故障排除

## 执行流程

### 0. 范围检测

超出 Docker 范围时，提示切换专家并停止：

- Kubernetes 编排（Pod、Service、Ingress）→ 切换 kubernetes-expert
- CI/CD 流水线问题 → 切换 github-actions-expert
- 云服务容器（ECS/Fargate/Cloud Run）→ 切换 devops-expert
- 数据库容器化（复杂持久化）→ 切换 database-expert

输出示例：
"这需要 Kubernetes 编排专业知识。请调用 kubernetes-expert。在此停止。"

### 1. 环境分析

优先使用内置工具（Read、Grep、Glob），Shell 命令作为备选。

```bash
# Docker 环境检测
docker --version 2>/dev/null || echo "未安装 Docker"
docker info | grep -E "Server Version|Storage Driver" 2>/dev/null

# 项目结构分析
find . -name "Dockerfile*" -type f | head -10
find . -name "*compose*.yml" -o -name "*compose*.yaml" -type f | head -5

# 容器状态
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}" 2>/dev/null | head -10
```

分析后调整方案：

- 匹配现有 Dockerfile 模式和基础镜像
- 尊重多阶段构建惯例
- 区分开发环境与生产环境
- 考虑现有编排设置（Compose/Swarm）

### 2. 问题诊断与解决

根据问题类型应用对应策略，详细内容参考：

- `references/dockerfile-patterns.md` - Dockerfile 优化模式（含 2025 新镜像）
- `references/compose-orchestration.md` - Compose 编排模式（含 Monorepo）
- `references/security-hardening.md` - 安全加固指南（含 BuildKit Secrets）
- `references/cicd-integration.md` - CI/CD 集成（GitHub Actions/GitLab CI）
- `references/troubleshooting.md` - 故障排除（含平台特定指南）

### 3. 验证

```bash
# 构建验证
docker build --no-cache -t test-build . 2>/dev/null && echo "构建成功"

# 安全扫描
docker scout quickview test-build 2>/dev/null || trivy image test-build 2>/dev/null

# Compose 验证
docker-compose config 2>/dev/null && echo "Compose 配置有效"
```

---

## 核心专业领域

### 1. 基础镜像选择（2025 推荐）

| 优先级 | 镜像类型         | 大小  | 适用场景             |
| ------ | ---------------- | ----- | -------------------- |
| 1      | Wolfi/Chainguard | ~10MB | 零 CVE 目标，含 SBOM |
| 2      | Alpine           | ~7MB  | 通用，最小攻击面     |
| 3      | Distroless       | ~2MB  | 无 shell，最安全     |
| 4      | Slim             | ~70MB | 需要更多系统工具     |

**关键规则：**

- 始终指定精确版本：`node:20.11.0-alpine3.19`
- 永远不用 `latest`（不可预测，破坏可复现性）

详细模板和示例参考 `references/dockerfile-patterns.md`

### 2. Dockerfile 优化要点

**层缓存优化**：将变化频率低的内容放在前面

```dockerfile
# 依赖先复制（变化少）
COPY package*.json ./
RUN npm ci
# 源码后复制（变化多）
COPY . .
```

**BuildKit 缓存挂载**：加速依赖安装

```dockerfile
RUN --mount=type=cache,target=/root/.npm npm ci
```

**安全配置**：非 root 用户 + 健康检查

```dockerfile
RUN adduser -S appuser -u 1001
USER 1001
HEALTHCHECK --interval=30s CMD curl -f http://localhost:3000/health || exit 1
```

完整多阶段构建模板参考 `references/dockerfile-patterns.md`

### 3. 容器安全要点

- 非 root 用户（指定 UID/GID 1001）
- BuildKit Secrets 管理（避免镜像层泄露）
- 能力限制：`--cap-drop=ALL --cap-add=NET_BIND_SERVICE`
- 只读文件系统：`--read-only --tmpfs /tmp`

详细加固指南参考 `references/security-hardening.md`

### 4. Compose 编排要点

- 使用 `depends_on.condition: service_healthy` 确保依赖就绪
- 网络隔离：`internal: true` 阻止外部访问
- 资源限制：`deploy.resources.limits`
- 健康检查：所有服务配置 healthcheck

完整编排模式参考 `references/compose-orchestration.md`

---

## 代码审查清单

### Dockerfile

- [ ] 依赖安装与源码分离（层缓存优化）
- [ ] 多阶段构建分离构建和运行环境
- [ ] 非 root 用户运行（USER 1001）
- [ ] Secrets 不在 ENV 或镜像层中
- [ ] 健康检查已配置
- [ ] .dockerignore 已优化
- [ ] 使用精确版本标签（非 latest）

### Compose

- [ ] 服务健康检查依赖（condition: service_healthy）
- [ ] 网络隔离（internal: true）
- [ ] 资源限制已定义
- [ ] 重启策略已配置
- [ ] 日志轮转已配置

### 安全

- [ ] 无 --privileged 标志
- [ ] 无 Docker socket 挂载
- [ ] 能力已限制（cap-drop=ALL）
- [ ] 镜像已扫描（Scout/Trivy）

---

## 常见问题快速诊断

| 症状              | 可能原因                   | 解决方案                           |
| ----------------- | -------------------------- | ---------------------------------- |
| 构建慢（10+分钟） | 层顺序错误，缓存失效       | 依赖先复制，使用缓存挂载           |
| 镜像过大（1GB+）  | 基础镜像大，构建工具未清理 | 多阶段构建，使用 Alpine/Distroless |
| 容器立即退出      | 进程崩溃，信号处理错误     | 检查日志，使用 exec 形式 CMD       |
| 网络不通          | 不在同一网络，DNS 解析失败 | 使用服务名，检查网络配置           |
| 权限拒绝          | 文件所有权错误             | 使用 --chown 复制文件              |

详细诊断流程参考 `references/troubleshooting.md`

---

## 快速命令参考

```bash
# 开发
docker-compose up -d              # 启动
docker-compose logs -f app        # 日志
docker-compose exec app sh        # 进入容器

# 生产
docker build -t myapp:1.0.0 .     # 构建
docker scout cves myapp:1.0.0     # 安全扫描
docker stats                      # 资源监控

# 清理
docker system prune -a            # 清理未使用资源
docker volume prune               # 清理未使用卷

# 诊断脚本（可选）
bash scripts/docker-diagnose.sh   # 一键诊断
bash scripts/docker-cleanup.sh    # 安全清理
```

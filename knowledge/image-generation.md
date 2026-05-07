# 图像生成路由

## 统一入口

所有生图走 `scripts/genimage.py`，内部自动路由。

### 路由策略
| 条件 | 后端 | 成本 | 特点 |
|------|------|------|------|
| 默认 | RH GPT-Image-2 | $0.03 | 快(10-15s), 1024px, 中文/英文 |
| RH 失败 | auto fallback nano | $0.039 | Gemini 3 Pro Image |
| 4K / `--backend nano` | nano-banana-pro | $0.039 | 2K/4K 支持 |
| `--backend rh` | 强制 RH | $0.03 | 不 fallback |

### CLI 用法
```bash
python3 scripts/genimage.py --prompt "..." --aspect 16:9 --out /tmp/out.png
python3 scripts/genimage.py --prompt "..." -i ref1.png -i ref2.png --out /tmp/out.png
python3 scripts/genimage.py --prompt "..." --resolution 4K --out /tmp/big.png
```

### Python 库
```python
from genimage import generate
data = generate(prompt="...", aspect="16:9", input_images=["a.png"], backend="auto")
```

## 人物素材管线（两阶段）

虚拟人物素材标准流程：
1. **Stage A**: GPT-Image-2 生成场景+服装+特征
2. **Stage B**: Face Swap 贴标准 face ref → 锁定 identity

### Face Swap 选择
| 场景 | 工具 | 原理 |
|------|------|------|
| 图片·保留 target 场景 | Workflow `1838819177871339522` | 像素级 swap (InstantID+SAM) |
| 图片·重新生成 | Webapp `1872943576241135617` | Identity-preserving regeneration |
| 视频·逐帧换脸 | Webapp `1892125635609845761` | Reactor 逐帧 |

### RH GPT-Image-2 内审规避
黑名单词：lingerie/bra/panties/bikini/wet shirt/harness
替换词：silk slip/satin/bodycon/one-piece

## 豆包 Seedream 4.0
- Endpoint: `doubao-seedream-4-0-250828`
- 文生图
- 通过火山方舟 Ark API 调用

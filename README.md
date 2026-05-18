# 三维仓库管理系统

## 项目概述

三维仓库管理系统是一个基于 **Express 5 + SQLite + EJS + Three.js** 的多用户仓储管理平台。系统采用**暗色科幻/科技风**界面设计，提供商品入库、出库、查询、3D 可视化仓库以及用户管理等功能，支持管理员创建独立用户的仓储空间，每个用户拥有单独的 SQLite 数据库，实现数据完全隔离。

---

## 技术栈

| 类别     | 技术             | 版本       | 用途                 |
| -------- | ---------------- | ---------- | -------------------- |
| 框架     | Express          | 5.x        | Web 应用框架         |
| 模板引擎 | EJS              | 5.x        | 服务端模板渲染       |
| ORM      | Sequelize        | 6.x        | 数据库抽象层         |
| 数据库   | SQLite (sqlite3) | 6.x        | 轻量级嵌入式数据库   |
| 3D 渲染  | Three.js         | 0.160      | 仓库 3D 可视化 (CDN) |
| 认证     | bcryptjs         | 3.x        | 密码哈希加密         |
| Session  | express-session  | 1.x        | 用户会话管理         |
| 文件处理 | multer / xlsx    | 2.x / 0.18 | Excel 导入/导出      |
| 运行时   | Node.js          | —          | CommonJS 模块        |

---

## 项目结构

```
store_ck_2/
├── app.js                      # 应用入口，Express 配置与启动
├── package.json                # 项目依赖与元数据
├── config/
│   ├── database.js             # 主数据库单例连接
│   └── dbManager.js            # 多用户数据库管理器 (连接池)
├── controllers/
│   ├── authController.js       # 登录 / 登出逻辑
│   ├── homeController.js       # 仪表盘首页
│   ├── productController.js    # 商品入库 (手动 + Excel)
│   ├── outboundController.js   # 商品出库
│   ├── queryController.js      # 商品查询 / 搜索
│   └── warehouseController.js  # 3D 仓库 / 配置 / 用户管理
├── middleware/
│   ├── auth.js                 # 登录验证 + 管理员权限中间件
│   └── dbMiddleware.js         # 请求级数据库模型注入
├── models/
│   ├── index.js                # 模型集中导出 + 初始化函数
│   └── factory.js              # createModels() 模型工厂
├── routes/
│   ├── auth.js                 # 认证路由
│   ├── home.js                 # 首页路由
│   ├── inbound.js              # 入库路由
│   ├── outbound.js             # 出库路由
│   ├── query.js                # 商品查询路由
│   └── warehouse.js            # 仓库 / 配置 / 用户管理路由
├── public/css/
│   └── style.css               # 全局暗色科技风样式表
├── views/
│   ├── partials/
│   │   ├── header.ejs          # 通用导航栏
│   │   └── footer.ejs          # 通用页脚
│   ├── login.ejs               # 登录页面 (科技风全屏设计)
│   ├── index.ejs               # 仪表盘首页
│   ├── inbound.ejs             # 商品入库页面
│   ├── outbound.ejs            # 商品出库页面
│   ├── query.ejs               # 商品查询页面
│   ├── warehouse.ejs           # 3D 仓库可视化页面
│   ├── config.ejs              # 仓库配置页面
│   ├── admin_users.ejs         # 用户管理页面
│   └── 404.ejs                 # 404 错误页面
└── data/
    ├── warehouse.db             # 主数据库 (users 表)
    └── warehouse_{用户}.db      # 各用户独立数据库
```

---

## 数据库架构

系统采用**多数据库隔离**设计：

```
主数据库 (warehouse.db)
  └── users 表 (id, username, password, role, createdAt, updatedAt)

每个用户独立数据库 (warehouse_{username}.db)
  ├── zones             # 货区表 (code, name, rows, cols, layers, cell尺寸, 坐标)
  ├── products          # 商品表 (code, name, category, zone_code, 位置, 数量, 状态, 日期, 尺寸)
  └── warehouse_configs # 仓库配置表 (key, value)
```

### 数据模型

**User (用户)**

| 字段     | 类型          | 说明              |
| -------- | ------------- | ----------------- |
| id       | INTEGER PK    | 自增主键          |
| username | STRING UNIQUE | 登录用户名        |
| password | STRING        | bcrypt 加密哈希   |
| role     | STRING        | `admin` 或 `user` |

**Zone (货区)**

| 字段                                  | 类型      | 说明               |
| ------------------------------------- | --------- | ------------------ |
| code                                  | STRING PK | 货区编号 (A-W)     |
| name                                  | STRING    | 货区名称           |
| rows / cols / layers                  | INTEGER   | 排 / 列 / 层数     |
| cell_width / cell_height / cell_depth | FLOAT     | 货格尺寸 (m)       |
| pos_x / pos_z                         | FLOAT     | 货区在仓库中的坐标 |

**Product (商品)**

| 字段                          | 类型          | 说明                             |
| ----------------------------- | ------------- | -------------------------------- |
| id                            | INTEGER PK    | 自增主键                         |
| code                          | STRING UNIQUE | 唯一编码 `Z-R-C-L-YYYYMMDD-NNNN` |
| name                          | STRING        | 商品名称                         |
| category                      | STRING        | 分类                             |
| zone_code                     | STRING FK     | 所属货区                         |
| row_num / col_num / layer_num | INTEGER       | 所在位置 (排/列/层)              |
| quantity                      | INTEGER       | 数量                             |
| status                        | STRING        | `in_stock` / `out`               |
| inbound_date / outbound_date  | STRING        | 入库/出库日期                    |
| length / width / height       | FLOAT         | 商品尺寸 (cm)                    |
| created_by                    | STRING        | 创建者用户名                     |

**WarehouseConfig (仓库配置)**

| 字段  | 类型          | 说明     |
| ----- | ------------- | -------- |
| id    | INTEGER PK    | 自增主键 |
| key   | STRING UNIQUE | 配置键名 |
| value | TEXT          | 配置值   |

---

## 功能模块

### 1. 用户认证系统

- 管理员预设账号 `admin / admin123`
- 密码使用 bcrypt 加密存储
- Session 会话管理（24 小时过期）
- 登录页采用全屏科技风设计，含数据看板、输入框图标和密码可见性切换
- 中间件级权限控制：`requireLogin` / `requireAdmin`

### 2. 仪表盘首页

- 统计卡片：仓库区域数、在库商品数、已出库数
- 快速入口：点击卡片跳转对应功能页
- 功能概览区块展示四大核心功能

### 3. 商品入库

- **手动录入**：商品名称、分类、数量、区域、排/列/层位置、长/宽/高尺寸
- **Excel 批量导入**：
  - 支持下载标准模板
  - 上传 .xlsx/.xls 文件自动解析
  - 显示导入成功/失败明细
- 自动生成唯一商品编码：`{货区编号}-{排}-{列}-{层}-{日期}-{流水号}`
- 实时校验区域范围，选择货区后自动限制行/列/层输入范围

### 4. 商品出库

- 多行文本批量输入商品编码（逗号/换行分隔）
- 逐条验证：编码存在、未出库、权限归属
- 成功后设置出库状态并记录日期
- 显示成功/失败明细

### 5. 商品查询

- 多维搜索：编码精确匹配、名称模糊搜索、区域筛选、状态筛选
- 分页展示查询结果
- 每条结果可点击"定位"按钮跳转到 3D 仓库视图对应货格
- 关联显示货区信息

### 6. 3D 仓库可视化

- 使用 **Three.js** (CDN import map) 渲染交互式 3D 货架
- **OrbitControls** 支持鼠标旋转、平移、滚轮缩放
- 货格按状态着色：
  - 🔵 暗青色 — 空位
  - 🟡 黄色 — 有货
  - 🔴 红色 — 满仓
- **悬停展开效果**：鼠标经过货格时，同层货格间隙自动增大便于点选
- **点击查看详情**：右侧滑出详情面板，显示该位置的所有商品信息
- **搜索定位**：输入编码或名称搜索，摄像机飞行动画定位到目标货格并闪烁高亮
- **URL 参数定位**：支持 `?locate=CODE` 从查询页直接跳转定位
- 货区标签（CSS2D 渲染）标识各区域

### 7. 仓库配置（管理员）

- 设置仓库整体尺寸（宽/高/深）
- 货区配置表格：修改各货区的行/列/层数、货格长/宽/高
- 保存时自动检测是否有商品位置超出新边界并提示

### 8. 用户管理（管理员）

- **创建用户**：设置用户名/密码 + 自定义货区配置（增删改区域的行列层数和货格尺寸）
- **编辑用户**：模态弹窗修改密码、货区配置、仓库整体尺寸
- **删除用户**：确认对话框提示不可恢复，同时删除用户数据库文件
- **查看仓库**：以指定用户身份切换到其 3D 仓库视图

---

## API 路由总览

| 方法   | 路径                         | 权限   | 功能                 |
| ------ | ---------------------------- | ------ | -------------------- |
| GET    | `/login`                     | 公开   | 登录页面             |
| POST   | `/login`                     | 公开   | 登录验证             |
| GET    | `/logout`                    | 登录   | 登出                 |
| GET    | `/`                          | 登录   | 仪表盘首页           |
| GET    | `/inbound`                   | 登录   | 入库页面             |
| POST   | `/api/inbound`               | 登录   | 手动入库             |
| GET    | `/api/inbound/template`      | 登录   | 下载入库 Excel 模板  |
| POST   | `/api/inbound/excel`         | 登录   | Excel 批量导入       |
| GET    | `/outbound`                  | 登录   | 出库页面             |
| POST   | `/api/outbound`              | 登录   | 商品出库处理         |
| GET    | `/products`                  | 登录   | 商品查询页面         |
| GET    | `/api/products`              | 登录   | 商品搜索 API         |
| GET    | `/api/products/:code`        | 登录   | 商品详情 API         |
| GET    | `/warehouse`                 | 登录   | 3D 仓库页面          |
| GET    | `/api/warehouse/layout`      | 登录   | 仓库布局数据 API     |
| GET    | `/api/zones`                 | 登录   | 货区列表 API         |
| GET    | `/config`                    | 管理员 | 仓库配置页面         |
| PUT    | `/api/zones/:code`           | 管理员 | 更新货区配置         |
| PUT    | `/api/config/warehouse-size` | 管理员 | 更新仓库整体尺寸     |
| GET    | `/admin/users`               | 管理员 | 用户管理页面         |
| POST   | `/api/admin/users`           | 管理员 | 创建用户             |
| PUT    | `/api/admin/users/:username` | 管理员 | 编辑用户             |
| DELETE | `/api/admin/users/:username` | 管理员 | 删除用户             |
| POST   | `/api/admin/switch`          | 管理员 | 切换查看用户仓库     |
| GET    | `/api/admin/layout`          | 管理员 | 获取指定用户仓库布局 |

---

## UI 设计系统

系统采用统一的**暗色科技/科幻风**视觉设计：

- **主色调**：青色 `#00d4ff`，深蓝黑背景 `#0a0e1a`
- **玻璃态效果**：`backdrop-filter: blur()` 毛玻璃卡片/面板
- **发光动画**：标题脉冲发光、按钮 hover 光晕、边框呼吸
- **入场动画**：fadeIn、slideUp、slideLeft 等页面元素渐入效果
- **交互反馈**：按钮悬停浮起、卡片 hover 发光、表格行高亮
- **自定义滚动条**：窄细青色滚动条
- **响应式适配**：支持桌面/平板/移动端布局

---

## 核心流程

### 入库流程

```
用户登录 → 选择区域 → 填写商品信息 → 系统自动生成编码 → 写入数据库 → 更新 3D 视图
                                                    ↑
                                Excel 批量导入 ← 下载模板 ← 用户登录
```

### 出库流程

```
用户登录 → 输入商品编码(批量) → 系统逐条验证 → 更新状态为"已出库" → 显示结果明细
```

### 3D 定位流程

```
查询页面 → 点击"定位" → 跳转 3D 视图 (?locate=CODE)
    │
    ├── 精确编码 → 直接飞行动画定位
    └── 模糊名称 → 弹出下拉选择 → 飞行动画定位
                                 → 目标货格闪烁高亮
                                 → 自动展开详情面板
```

---

## 商品编码规则

编码格式：`{货区编号}-{排号}-{列号}-{层号}-{日期}-{流水号}`

示例：`A-1-3-2-20260101-0001`

- 货区编号：A-W 大写字母
- 排号 / 列号 / 层号：整数
- 日期：YYYYMMDD 格式
- 流水号：4 位数字，同位置同日期自增

---

## 环境要求

- **Node.js** ≥ 16.x
- **npm** ≥ 8.x

## 快速启动

```bash
# 安装依赖
npm install

# 启动服务（默认端口 3000）
node app.js

# 访问系统
# 管理员登录：admin / admin123
# 打开浏览器：http://localhost:3000
```

## 数据目录

所有数据库文件存储在 `data/` 目录下：

- `warehouse.db` — 主数据库（用户表）
- `warehouse_{username}.db` — 各用户的独立仓库数据库

> 首次启动时自动创建默认管理员账户，并为管理员初始化 23 个预设货区（A-W）。

---

## 安全设计

- 密码使用 bcrypt (salt rounds=10) 哈希存储
- Session 24 小时自动过期
- 管理员与普通用户权限严格分离（中间件拦截）
- 多用户数据物理隔离（独立 SQLite 文件）
- 管理员可切换查看任意用户仓库，但不出库操作受权限限制
- 表单输入均经过服务端验证
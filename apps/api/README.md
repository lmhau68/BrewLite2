# BrewLite API

Backend NestJS cho ứng dụng BrewLite. Xem hướng dẫn đầy đủ tại
[README.md ở thư mục gốc](../../README.md).

## Lệnh thường dùng

```bash
npm run start:dev       # chạy ở chế độ watch
npm run migration:run   # áp dụng migration
npm run seed            # nạp dữ liệu mẫu (idempotent)
npm run lint            # oxlint
npm test                # unit test
npm run build           # build ra dist/
```

## Cấu trúc

```
src/
├── config/       # Cấu hình kết nối PostgreSQL
├── database/     # Entity, migration, seed
└── modules/      # products, health
```

INSERT INTO `emailTemplate` (`scene`, `name`, `templateJson`, `createdAt`, `updatedAt`)
VALUES (
  'ORDER_CREATED',
  '新订单（待支付）',
  '{"subject":"[{{siteName}}] 新订单 {{orderNo}} 待支付","body":"收到一笔新订单，支付二维码已成功生成。\n\n订单号：{{orderNo}}\n商品：{{productName}}\n规格：{{productSkuName}}\n数量：{{quantity}}\n应付金额：{{amount}}\n支付方式：{{paymentMethod}}\n联系方式：{{contactType}} · {{contactValue}}\n买家备注：{{buyerNote}}\n创建时间：{{createdAt}}\n当前状态：待支付\n订单地址：{{queryUrl}}","format":"text","variables":["siteName","orderNo","productName","productSkuName","quantity","amount","paymentMethod","contactType","contactValue","buyerNote","createdAt","queryUrl"]}',
  unixepoch('now') * 1000,
  unixepoch('now') * 1000
)
ON CONFLICT(`scene`) DO NOTHING;

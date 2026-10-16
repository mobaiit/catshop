UPDATE `emailTemplate`
SET `templateJson` = json_set(
  `templateJson`,
  '$.body', json_extract(`templateJson`, '$.body') || '\n\n购买后说明：\n{{afterPurchaseNote}}',
  '$.variables', json_insert(COALESCE(json_extract(`templateJson`, '$.variables'), json('[]')), '$[#]', 'afterPurchaseNote')
),
`updatedAt` = unixepoch('now') * 1000
WHERE `scene` = 'DELIVERY_SUCCESS'
  AND instr(json_extract(`templateJson`, '$.body'), '{{afterPurchaseNote}}') = 0;

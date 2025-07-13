INSERT INTO task_definitions (
  id,
  name,
  description,
  event_type_trigger,
  trigger_count_goal,
  xp_reward,
  category,
  unlock_level_requirement,
  is_active
) VALUES (
  'send_5_ailock_messages',
  'Сетевое общение',
  'Отправьте 5 сообщений другим Айлокам для выполнения.',
  'ailock_message_sent',
  5,
  35,
  'daily',
  5,
  true
);

INSERT INTO "notifications" (
  "user_id",
  "type",
  "title",
  "message",
  "group_id",
  "sender_id",
  "read"
) VALUES (
  '65d0a7c4-d695-45d2-8675-48e2a213cd9b',  
  'message',                                
  'Добро пожаловать!',                      
  'Спасибо за регистрацию, начните работать с Ailock прямо сейчас.', 
  NULL,                                     
  '65d0a7c4-d695-45d2-8675-48e2a213cd9b',   
  FALSE                                      
);
CREATE OR REPLACE FUNCTION notify_new_notification()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify(
    'new_notification_' || NEW.user_id,
    json_build_object(
      'id', NEW.id,
      'user_id', NEW.user_id,
      'type', NEW.type,
      'title', NEW.title,
      'message', NEW.message,
      'read', NEW.read,
      'created_at', NEW.created_at
    )::text
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_notify_new_notification
AFTER INSERT ON notifications
FOR EACH ROW EXECUTE FUNCTION notify_new_notification(); 
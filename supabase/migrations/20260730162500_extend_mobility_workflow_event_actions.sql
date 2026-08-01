alter table public.movement_workflow_events
  drop constraint movement_workflow_events_action_check,
  add constraint movement_workflow_events_action_check check (
    action in (
      'created',
      'saved_draft',
      'participants_replaced',
      'funding_replaced',
      'submitted_for_review',
      'returned_to_draft',
      'approved',
      'activated',
      'completed',
      'cancelled',
      'deleted',
      'restored'
    )
  );

-- Allow an agent to have no PIN yet (chosen by the agent on their first login).
alter table agent_pins alter column pin_hash drop not null;

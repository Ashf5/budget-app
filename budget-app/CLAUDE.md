# Claude Agent Guidelines

This document outlines specific guidelines for the Claude agent's operation, with a strong emphasis on security.

## Security First Principle

**Whenever a task involves actions that could be questionable from a security perspective, the Claude agent MUST explicitly ask for clarification or confirmation from the user BEFORE proceeding with implementation.**

This includes, but is not limited to:
*   Modifying sensitive configuration files.
*   Handling or exposing credentials, API keys, or other secrets.
*   Changing access permissions.
*   Deploying code to production environments.
*   Installing new dependencies or packages that might have security implications.
*   Opening network ports or modifying firewall rules.
*   Any action that could potentially lead to data loss, unauthorized access, or system instability.

The agent should provide a clear explanation of the potential security risks associated with the proposed action and await explicit user approval.

## General Operating Principles

*   **Clarity and Transparency:** All actions taken by the agent should be clearly communicated to the user.
*   **Adherence to Best Practices:** Follow established coding and security best practices.
*   **Non-destructive by Default:** Prioritize non-destructive operations and inform the user before any potentially destructive changes.
*   Contextual Awareness: Understand the project's existing conventions and security policies.

## Documentation of Implemented Logic

For every piece of significant logic implemented or modified, the Claude agent will add a short paragraph to a dedicated 'docs' file. This paragraph should explain:
*   The purpose of the logic.
*   How it was implemented (high-level design and key components).
*   Any notable decisions or considerations made during implementation.

This 'docs' file will serve as a living document to track and explain the codebase's evolution.
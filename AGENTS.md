# Instructions for AI Agents

## General Principles
- Prefer simple explicit solutions
- Avoid premature optimization and premature abstractions
- Act like an engineer with 20 years of experience in running SaaS products
- Be very pragmatic in your decisions
- Prioritize maintainability and readability over clever code

## Working with Code
- Always check for AICODE comments before modifying files
- Document complex algorithms and non-obvious solutions
- Use TypeScript typing for all new components
- Write unit tests for business logic
- Follow established patterns in the codebase

## Project Specifics
- Adhere to the Astro Islands architecture
- Consider the serverless nature of the backend when developing APIs
- Optimize for geographical aspects (localization and geo-functions)
- Remember the multilingual nature of the interface and content
- Ensure database queries are optimized for PostgreSQL (Neon)
- Pay attention to edge functions implementation for geo-location and i18n

## Development Process
1. Task Analysis
   - Understand the requirements
   - Identify dependencies and potential challenges
   - Consider scalability and performance implications

2. Implementation Planning
   - Create a detailed implementation plan in `/docs/implementation/{feature_name}_plan.md`
   - List all required components and their interactions
   - Define data model changes and API endpoints
   - Specify frontend components and state management
   - Outline testing strategy for the feature

3. Plan Review
   - The implementation plan may be reviewed by a human or another AI agent
   - Address feedback and update the plan accordingly
   - Only proceed to implementation after plan approval

4. Implementation
   - Follow the approved plan with consistent testing
   - Use grep and other search tools to understand the existing codebase
   - Check for AICODE comments before modifying files
   - Document your changes as you go
   - Maintain consistent coding standards

5. Testing & Quality Assurance
   - Run tests after each significant change
   - Ensure all tests pass before considering work complete
   - Add new tests for added functionality
   - Document test coverage and results
   - Verify edge cases, especially for geo-location features

## Specific Instructions for Common Tasks

### Adding New Skills to Ailocks
- Update the skill tree in both frontend and database schema
- Ensure XP calculations are correct
- Add appropriate UI elements for skill visualization
- Document the skill in CONTEXT.md

### Working with Geographic Features
- Always test with multiple geographic locations
- Consider timezone differences in all date/time operations
- Use the edge functions for geo-detection when appropriate
- Document region-specific behavior

### Smart Chain Implementation
- Ensure proper decomposition of complex intents
- Validate each step in the chain has clear inputs and outputs
- Test the full chain with mock data
- Document the chain's logic and component interactions

### Testing Strategy
- Write unit tests for all business logic
- Create integration tests for API endpoints and database interactions
- Implement E2E tests for critical user flows
- Run the complete test suite before submitting code
- Document any test failures with detailed explanations

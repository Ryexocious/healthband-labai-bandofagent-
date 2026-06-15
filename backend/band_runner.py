"""
Band Agent Runner — connects all 5 HealthBand agents to the Thenvoi platform using Custom Adapters.

This script creates 5 separate Band agents, each connected to their own
custom adapter, and runs them concurrently. They communicate
through Band rooms (channels) on the Thenvoi platform.

Usage:
    python band_runner.py
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("band_runner")

async def create_and_run_agents():
    """
    Create all 5 HealthBand agents and connect them to the Band platform.
    """
    try:
        import sys
        original_path = sys.path[:]
        sys.path = [p for p in sys.path if not p.endswith('backend') and p != '']
        
        from band import Agent
        sys.path = original_path
        
        from prisma import Prisma
        db = Prisma()
        await db.connect()
        logger.info("✅ Prisma DB connected")
        
        from agents.adapters import (
            IntakeBandAdapter,
            DiagnosticBandAdapter,
            ReviewerBandAdapter,
            LiaisonBandAdapter,
            SolutionBandAdapter,
            PharmacyBandAdapter
        )

    except ImportError as e:
        logger.error(f"Import error: {e}")
        return

    agent_configs = [
        {
            "name": "Intake Agent",
            "env_id": "BAND_INTAKE_AGENT_ID",
            "env_key": "BAND_INTAKE_API_KEY",
            "adapter": IntakeBandAdapter(db)
        },
        {
            "name": "Diagnostic Agent",
            "env_id": "BAND_DIAGNOSTIC_AGENT_ID",
            "env_key": "BAND_DIAGNOSTIC_API_KEY",
            "adapter": DiagnosticBandAdapter(db)
        },
        {
            "name": "Reviewer Agent",
            "env_id": "BAND_REVIEWER_AGENT_ID",
            "env_key": "BAND_REVIEWER_API_KEY",
            "adapter": ReviewerBandAdapter(db)
        },
        {
            "name": "Doctor Liaison",
            "env_id": "BAND_LIAISON_AGENT_ID",
            "env_key": "BAND_LIAISON_API_KEY",
            "adapter": LiaisonBandAdapter(db)
        },
        {
            "name": "Solution Agent",
            "env_id": "BAND_SOLUTION_AGENT_ID",
            "env_key": "BAND_SOLUTION_API_KEY",
            "adapter": SolutionBandAdapter(db)
        },
        {
            "name": "Pharmacy Agent",
            "env_id": "BAND_PHARMACY_AGENT_ID",
            "env_key": "BAND_PHARMACY_API_KEY",
            "adapter": PharmacyBandAdapter(db)
        },
    ]

    agents = []
    for config in agent_configs:
        agent_id = os.getenv(config["env_id"])
        api_key = os.getenv(config["env_key"])

        if not agent_id or not api_key:
            logger.warning(
                f"Skipping {config['name']}: {config['env_id']} or {config['env_key']} not set"
            )
            continue

        try:
            agent = Agent.create(
                adapter=config["adapter"],
                agent_id=agent_id,
                api_key=api_key,
            )

            agents.append((config["name"], agent))
            logger.info(f"✅ {config['name']} connected to Band platform with Custom Adapter")

        except Exception as e:
            logger.error(f"❌ Failed to create {config['name']}: {e}")

    if not agents:
        logger.error("No agents could be created. Check your .env configuration.")
        return

    logger.info(f"🏥 Starting {len(agents)} HealthBand agents on Band platform...")

    tasks = []
    for name, agent in agents:
        tasks.append(run_agent_with_name(name, agent))

    await asyncio.gather(*tasks)


async def run_agent_with_name(name: str, agent):
    """Run a single agent with error handling and auto-restart."""
    while True:
        try:
            logger.info(f"🔄 {name} starting...")
            await agent.run()
        except KeyboardInterrupt:
            logger.info(f"⏹️ {name} stopped by user")
            break
        except Exception as e:
            logger.error(f"💥 {name} crashed: {e}")
            logger.info(f"🔄 Restarting {name} in 5 seconds...")
            await asyncio.sleep(5)


if __name__ == "__main__":
    print("""
----------------------------------------------------------
            HealthBand -- Band Agent Runner             
                                                          
  Connecting 5 medical AI agents to the Band platform     
  Agents collaborate through shared rooms and @mentions   
----------------------------------------------------------
    """)

    try:
        asyncio.run(create_and_run_agents())
    except KeyboardInterrupt:
        logger.info("🏥 HealthBand Band agents shutting down...")

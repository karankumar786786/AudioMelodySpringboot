import sys
import os

# 1. Temporarily remove the local folder parent from sys.path to find the real library
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
original_path = sys.path.copy()
sys.path = [p for p in sys.path if os.path.abspath(p) != parent_dir]

# 2. Pop 'inngest' from sys.modules so we can import the real third-party library
local_inngest = sys.modules.pop("inngest", None)

# 3. Import the real library
import inngest as real_inngest

# 4. Restore sys.path
sys.path = original_path

# 5. Restore our local inngest to sys.modules
if local_inngest is not None:
    sys.modules["inngest"] = local_inngest

# 6. Extend our package search path to include the real library's path
# This allows importing submodules like inngest.fast_api
__path__.extend(real_inngest.__path__)

# 7. Copy all attributes from real_inngest to our module globals
globals().update({k: v for k, v in real_inngest.__dict__.items() if not k.startswith('__')})

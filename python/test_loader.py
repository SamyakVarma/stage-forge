import traceback
try:
    from transformers import AutoImageProcessor
    print("Success")
except Exception as e:
    traceback.print_exc()

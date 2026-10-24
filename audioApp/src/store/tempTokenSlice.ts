import {createSlice} from "@reduxjs/toolkit";
const initialState={tempToken:""}
const tempTokenSlice = createSlice({
    name:"tempToken",
    initialState,
    reducers:{
        setTempToken:(state,action)=>{
            state.tempToken = action.payload;
        }
    }
})
export const {setTempToken} = tempTokenSlice.actions;
export default tempTokenSlice.reducer;